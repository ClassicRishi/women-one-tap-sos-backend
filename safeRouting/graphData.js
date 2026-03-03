/**
 * ══════════════════════════════════════════════════════════
 *  DISTRICT ROAD NETWORK & COORDINATES
 *  Tamil Nadu + Karnataka sub-areas / cities / districts
 * ══════════════════════════════════════════════════════════
 */

// [districtA, districtB, distanceKm]
const roads = [
  // ─── Tamil Nadu internal routes ───
  ["Chennai", "Kanchipuram", 75],
  ["Chennai", "Tiruvallur", 45],
  ["Chennai", "Chengalpattu", 55],
  ["Kanchipuram", "Vellore", 90],
  ["Kanchipuram", "Villupuram", 95],
  ["Chengalpattu", "Villupuram", 110],
  ["Chengalpattu", "Kanchipuram", 40],
  ["Tiruvallur", "Kanchipuram", 65],
  ["Tiruvallur", "Vellore", 120],
  ["Vellore", "Krishnagiri", 85],
  ["Vellore", "Tiruvannamalai", 90],
  ["Tiruvannamalai", "Villupuram", 70],
  ["Tiruvannamalai", "Salem", 110],
  ["Villupuram", "Cuddalore", 35],
  ["Villupuram", "Salem", 140],
  ["Cuddalore", "Thanjavur", 145],
  ["Cuddalore", "Nagapattinam", 80],
  ["Salem", "Erode", 65],
  ["Salem", "Namakkal", 55],
  ["Salem", "Krishnagiri", 95],
  ["Salem", "Dharmapuri", 70],
  ["Erode", "Coimbatore", 95],
  ["Erode", "Tirupur", 50],
  ["Erode", "Namakkal", 55],
  ["Coimbatore", "Tirupur", 55],
  ["Coimbatore", "Nilgiris", 85],
  ["Coimbatore", "Dindigul", 135],
  ["Namakkal", "Tiruchirappalli", 60],
  ["Tiruchirappalli", "Thanjavur", 55],
  ["Tiruchirappalli", "Dindigul", 95],
  ["Tiruchirappalli", "Pudukkottai", 50],
  ["Thanjavur", "Nagapattinam", 85],
  ["Dindigul", "Madurai", 65],
  ["Dindigul", "Theni", 65],
  ["Madurai", "Sivagangai", 45],
  ["Madurai", "Virudhunagar", 60],
  ["Madurai", "Theni", 75],
  ["Virudhunagar", "Ramanathapuram", 80],
  ["Virudhunagar", "Thoothukudi", 85],
  ["Virudhunagar", "Tirunelveli", 85],
  ["Tirunelveli", "Thoothukudi", 50],
  ["Tirunelveli", "Kanyakumari", 85],
  ["Thoothukudi", "Kanyakumari", 130],
  ["Dharmapuri", "Krishnagiri", 55],

  // ─── Extra TN cross-connections (for multiple alternative routes) ───
  ["Salem", "Nilgiris", 170],           // via hill road (longer but alternate)
  ["Salem", "Tirupur", 110],            // direct alternate
  ["Salem", "Coimbatore", 160],         // direct (longer alternate)
  ["Nilgiris", "Tirupur", 100],         // hill road
  ["Nilgiris", "Erode", 140],           // alternate via hills
  ["Dindigul", "Tirupur", 110],         // cross link
  ["Namakkal", "Dindigul", 115],        // cross link
  ["Namakkal", "Erode", 55],            // already exists but adds path diversity
  ["Dharmapuri", "Tiruvannamalai", 95],  // cross link
  ["Dharmapuri", "Erode", 130],         // alternate
  ["Cuddalore", "Tiruchirappalli", 155], // coastal alternate
  ["Madurai", "Tiruchirappalli", 130],  // direct link
  ["Madurai", "Thoothukudi", 135],      // direct
  ["Sivagangai", "Ramanathapuram", 60], // cross link
  ["Sivagangai", "Pudukkottai", 55],    // cross link
  ["Thanjavur", "Pudukkottai", 55],     // cross link
  ["Thanjavur", "Dindigul", 165],       // alternate
  ["Chennai", "Villupuram", 155],       // direct coastal

  // ─── Karnataka internal routes ───
  ["Bengaluru City", "Bengaluru Rural", 35],
  ["Bengaluru City", "Ramanagara", 55],
  ["Bengaluru City", "Tumakuru", 70],
  ["Bengaluru City", "Kolar", 65],
  ["Bengaluru City", "Chikkaballapura", 55],
  ["Bengaluru Rural", "Ramanagara", 40],
  ["Ramanagara", "Mandya", 55],
  ["Ramanagara", "Mysuru", 95],
  ["Mandya", "Mysuru", 45],
  ["Mandya", "Hassan", 85],
  ["Mysuru", "Chamarajanagar", 60],
  ["Mysuru", "Kodagu", 95],
  ["Mysuru", "Hassan", 115],
  ["Tumakuru", "Chitradurga", 115],
  ["Tumakuru", "Hassan", 130],
  ["Tumakuru", "Davangere", 180],
  ["Chitradurga", "Davangere", 70],
  ["Chitradurga", "Bellary", 120],
  ["Davangere", "Haveri", 75],
  ["Davangere", "Shimoga", 85],
  ["Shimoga", "Udupi", 125],
  ["Shimoga", "Chikkamagaluru", 60],
  ["Chikkamagaluru", "Hassan", 50],
  ["Chikkamagaluru", "Kodagu", 100],
  ["Hassan", "Chikkamagaluru", 50],
  ["Haveri", "Dharwad", 65],
  ["Dharwad", "Belagavi", 75],
  ["Dharwad", "Gadag", 55],
  ["Belagavi", "Bagalkot", 100],
  ["Gadag", "Bagalkot", 60],
  ["Gadag", "Koppal", 65],
  ["Koppal", "Raichur", 60],
  ["Raichur", "Yadgir", 75],
  ["Raichur", "Bellary", 75],
  ["Bellary", "Koppal", 70],
  ["Yadgir", "Kalaburagi", 80],
  ["Kalaburagi", "Bidar", 110],
  ["Kolar", "Chikkaballapura", 35],
  ["Udupi", "Dakshina Kannada", 55],
  ["Dakshina Kannada", "Kodagu", 115],

  // ─── Cross-state connections ───
  ["Krishnagiri", "Bengaluru City", 90],
  ["Krishnagiri", "Kolar", 80],
  ["Krishnagiri", "Chikkaballapura", 100],
  ["Nilgiris", "Mysuru", 135],
  ["Coimbatore", "Chamarajanagar", 190],
];

// Lat/Lng for each district
const districtCoords = {
  // ─── Tamil Nadu ───
  "Chennai": [13.0827, 80.2707],
  "Kanchipuram": [12.837, 79.7],
  "Tiruvallur": [13.1431, 79.9094],
  "Chengalpattu": [12.6819, 79.9888],
  "Vellore": [12.9165, 79.1325],
  "Tiruvannamalai": [12.2253, 79.0747],
  "Villupuram": [11.9395, 79.4924],
  "Cuddalore": [11.7480, 79.7714],
  "Salem": [11.6643, 78.146],
  "Namakkal": [11.2189, 78.1674],
  "Erode": [11.3410, 77.7172],
  "Coimbatore": [11.0168, 76.9558],
  "Tirupur": [11.1085, 77.3411],
  "Nilgiris": [11.4916, 76.7337],
  "Krishnagiri": [12.5186, 78.2137],
  "Dharmapuri": [12.1211, 78.1582],
  "Tiruchirappalli": [10.7905, 78.7047],
  "Thanjavur": [10.787, 79.1378],
  "Nagapattinam": [10.7672, 79.8449],
  "Pudukkottai": [10.3833, 78.8001],
  "Dindigul": [10.3673, 77.9803],
  "Madurai": [9.9252, 78.1198],
  "Theni": [10.0104, 77.4768],
  "Sivagangai": [9.8433, 78.4809],
  "Virudhunagar": [9.5851, 77.9526],
  "Ramanathapuram": [9.3762, 78.8308],
  "Thoothukudi": [8.7642, 78.1348],
  "Tirunelveli": [8.7139, 77.7567],
  "Kanyakumari": [8.0883, 77.5385],

  // ─── Karnataka ───
  "Bengaluru City": [12.9716, 77.5946],
  "Bengaluru Rural": [13.1263, 77.3920],
  "Ramanagara": [12.7159, 77.2814],
  "Tumakuru": [13.3379, 77.1173],
  "Kolar": [13.1362, 78.1292],
  "Chikkaballapura": [13.4355, 77.7315],
  "Mandya": [12.5222, 76.8952],
  "Mysuru": [12.2958, 76.6394],
  "Chamarajanagar": [11.9236, 76.9398],
  "Hassan": [13.0072, 76.0996],
  "Kodagu": [12.4244, 75.7382],
  "Chikkamagaluru": [13.3161, 75.7720],
  "Shimoga": [13.9299, 75.5681],
  "Davangere": [14.4644, 75.9218],
  "Chitradurga": [14.2226, 76.3980],
  "Bellary": [15.1394, 76.9214],
  "Haveri": [14.7951, 75.3991],
  "Dharwad": [15.4589, 75.0078],
  "Belagavi": [15.8497, 74.4977],
  "Gadag": [15.4319, 75.6348],
  "Bagalkot": [16.1691, 75.6968],
  "Koppal": [15.3547, 76.1548],
  "Raichur": [16.2076, 77.3463],
  "Yadgir": [16.7700, 77.1330],
  "Kalaburagi": [17.3297, 76.8343],
  "Bidar": [17.9104, 77.5199],
  "Udupi": [13.3409, 74.7421],
  "Dakshina Kannada": [12.8438, 75.2479],
};

module.exports = { roads, districtCoords };