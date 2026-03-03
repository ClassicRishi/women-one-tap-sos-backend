const { MongoClient } = require("mongodb");
const { roads } = require("./graphData");

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

/**
 * ══════════════════════════════════════════════════════════
 *  MULTI-FACTOR SAFETY SCORING ENGINE
 * ──────────────────────────────────────────────────────────
 *  Factors considered for each district:
 *
 *  1. CRIME RATE       → crimes_against_women / population
 *     Lower = safer.  Weight: 0.40
 *
 *  2. POLICE COVERAGE  → police_stations per 100k population
 *     Higher = safer.  Weight: 0.30
 *
 *  3. CROWD DENSITY    → population (proxy for crowd / footfall)
 *     Higher population = more people around = safer.  Weight: 0.20
 *
 *  4. TIME OF DAY      → night-time multiplier on risk
 *     Night hours amplify crime risk.  Weight: built into formula
 *
 *  5. LITERACY RATE    → literacy or awareness indicator
 *     Higher = safer environment.  Weight: 0.10
 *
 *  Final riskScore per district: 0 (safest) → 1 (most dangerous)
 * ══════════════════════════════════════════════════════════
 */

async function loadRisk() {
  await client.connect();
  const db = client.db("policeDB");

  const tn = await db.collection("tamilnadu").find().toArray();
  const ka = await db.collection("karnataka").find().toArray();
  const districts = [...tn, ...ka];

  // ── compute raw metrics per district ──
  districts.forEach((d) => {
    // crime rate: crimes against women per 100k population
    const crimeCount = d.crimes_against_women || d.crime_count || d.total_crimes || 0;
    d.crimeRate = d.population ? (crimeCount / d.population) * 100000 : 50;

    // police coverage: stations per 100k population (higher = better)
    d.policeCoverage = d.population && d.police_stations
      ? (d.police_stations / d.population) * 100000
      : 5;

    // crowd density: raw population (higher = more people = safer for women)
    d.crowdDensity = d.population || 500000;

    // literacy / awareness (if available in DB)
    d.literacyRate = d.literacy_rate || d.literacy || 75;
  });

  // ── normalize each metric to 0–1 range ──
  function normalize(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map((v) => (v - min) / range);
  }

  const crimeRates = normalize(districts.map((d) => d.crimeRate));
  const policeCovers = normalize(districts.map((d) => d.policeCoverage));
  const crowdDensity = normalize(districts.map((d) => d.crowdDensity));
  const literacy = normalize(districts.map((d) => d.literacyRate));

  // ── weighted risk score ──
  // crimeRate:       higher = more dangerous → positive contribution
  // policeCoverage:  higher = safer          → negative contribution (subtract)
  // crowdDensity:    higher = safer          → negative contribution (subtract)
  // literacy:        higher = safer          → negative contribution (subtract)

  const W_CRIME = 0.40;
  const W_POLICE = 0.30;
  const W_CROWD = 0.20;
  const W_LITERACY = 0.10;

  let riskMap = {};

  districts.forEach((d, i) => {
    let risk =
      W_CRIME * crimeRates[i]          // more crime → higher risk
      - W_POLICE * policeCovers[i]       // more police → lower risk
      - W_CROWD * crowdDensity[i]       // more crowd → lower risk
      - W_LITERACY * literacy[i];        // higher literacy → lower risk

    // clamp to 0–1
    risk = Math.max(0, Math.min(1, (risk + 0.6) / 1.2)); // shift & scale to [0,1]

    riskMap[d.district] = risk;
  });

  console.log("✅ Multi-factor risk data loaded:");
  console.log("   Factors: Crime Rate (40%), Police Stations (30%), Crowd Density (20%), Literacy (10%)");
  console.log("   Districts:", Object.keys(riskMap).length);

  return riskMap;
}

/**
 * Time-of-day risk multiplier:
 *   Day    (06:00–18:00) → 1.0x  (normal)
 *   Evening(18:00–22:00) → 1.3x  (slightly riskier)
 *   Night  (22:00–06:00) → 1.8x  (much riskier — less crowd, less police patrol)
 */
function timeFactor() {
  const h = new Date().getHours();
  if (h >= 6 && h < 18) return 1.0;
  if (h >= 18 && h < 22) return 1.3;
  return 1.8;
}

// build adjacency list with weights and base distances
function buildGraph(risk) {
  const mult = timeFactor();
  let graph = {};

  roads.forEach(([a, b, distKm]) => {
    // average risk of both ends of the road segment
    const r = ((risk[a] || 0.5) + (risk[b] || 0.5)) / 2;
    // weight = distance * (1 + riskPenalty * timeMultiplier)
    const weight = distKm * (1 + r * mult);

    if (!graph[a]) graph[a] = [];
    if (!graph[b]) graph[b] = [];

    graph[a].push({ node: b, w: weight, km: distKm });
    graph[b].push({ node: a, w: weight, km: distKm });
  });

  return graph;
}

// compute score for a given path
function scorePath(path, graph) {
  let totalCost = 0;
  let totalKm = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const edge = graph[from].find((e) => e.node === to);
    if (!edge) continue;
    totalCost += edge.w;
    totalKm += edge.km;
  }

  const avgRiskPenalty = totalCost / (totalKm || 1);
  // normalize so lower risk → higher safety score
  const normalized = 1 / (1 + avgRiskPenalty / 100);
  const safetyScore = Math.max(0, Math.min(100, Math.round(normalized * 100)));

  return { totalCost, totalKm, safetyScore };
}

// enumerate all simple paths with DFS (graph is tiny)
function findAllPaths(start, end, graph, maxPaths = 10) {
  let results = [];
  function dfs(node, visited, path) {
    if (path.length > 10) return; // safety guard
    if (node === end) {
      results.push([...path]);
      return;
    }
    for (const nb of graph[node] || []) {
      if (visited.has(nb.node)) continue;
      visited.add(nb.node);
      path.push(nb.node);
      dfs(nb.node, visited, path);
      path.pop();
      visited.delete(nb.node);
    }
  }
  const visited = new Set([start]);
  dfs(start, visited, [start]);
  return results.slice(0, maxPaths);
}

// single safest path (kept for compatibility)
function safestPath(start, end, risk) {
  const graph = buildGraph(risk);
  const paths = findAllPaths(start, end, graph, 5);
  if (!paths.length) return { path: [], cost: 0, safetyScore: 0 };

  const scored = paths.map((p) => {
    const { totalCost, safetyScore } = scorePath(p, graph);
    return { path: p, cost: totalCost, safetyScore };
  });

  scored.sort((a, b) => b.safetyScore - a.safetyScore);
  return scored[0];
}

// top-k DIVERSE routes: safest, shortest, and balanced
function multiSafePaths(start, end, risk, k = 3) {
  const graph = buildGraph(risk);
  const paths = findAllPaths(start, end, graph, 15);
  if (!paths.length) return [];

  const scored = paths.map((p) => {
    const { totalCost, totalKm, safetyScore } = scorePath(p, graph);
    const estimatedMinutes = Math.round((totalKm / 60) * 60); // avg 60 km/h
    return {
      path: p,
      cost: totalCost,
      km: totalKm,
      safetyScore,
      estimatedMinutes,
    };
  });

  // ── Pick 3 diverse routes ──
  // 1. SAFEST: highest safety score (regardless of distance)
  const bySafety = [...scored].sort((a, b) => b.safetyScore - a.safetyScore);
  const safest = bySafety[0];

  // 2. SHORTEST: minimum distance (regardless of safety)
  const byDistance = [...scored].sort((a, b) => a.km - b.km);
  const shortest = byDistance.find(
    (r) => JSON.stringify(r.path) !== JSON.stringify(safest.path)
  ) || byDistance[0];

  // 3. BALANCED: best combo (safety * 0.5 + distanceRank * 0.5)
  //    or just the best route that's different from the other two
  const usedPaths = new Set([
    JSON.stringify(safest.path),
    JSON.stringify(shortest.path),
  ]);
  const balanced = scored.find(
    (r) => !usedPaths.has(JSON.stringify(r.path))
  );

  // Assemble final result: always safest first, then balanced, then shortest
  const result = [safest];
  if (balanced) result.push(balanced);
  if (
    JSON.stringify(shortest.path) !== JSON.stringify(safest.path) &&
    (!balanced || JSON.stringify(shortest.path) !== JSON.stringify(balanced.path))
  ) {
    result.push(shortest);
  }

  // If we still have fewer than k, fill from remaining
  if (result.length < k) {
    for (const r of scored) {
      if (result.length >= k) break;
      const key = JSON.stringify(r.path);
      if (!usedPaths.has(key)) {
        result.push(r);
        usedPaths.add(key);
      }
    }
  }

  // Add labels
  const labels = ["Safest Route", "Moderate Route", "Shortest Route"];
  return result.slice(0, k).map((r, i) => ({
    ...r,
    safetyLabel: labels[i] || "Route",
  }));
}

module.exports = { loadRisk, safestPath, multiSafePaths };