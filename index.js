const { loadRisk, safestPath, multiSafePaths } = require("./safeRouting/riskEngine");
const { districtCoords } = require("./safeRouting/graphData");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: ".env", quiet: true })
const { db, auth } = require("./firebase/firebase.init.js")
const bcrypt = require("bcrypt");
const { MongoClient } = require("mongodb");

// set up middleware
const app = express();
const PORT = process.env.PORT;
const HOST_URL = process.env.HOST_URL;
// app.use(cors({
//   origin: HOST_URL,
//   methods: ["GET","POST"],
//   credentials: true
// }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "pug")
// app.use('/frontend', createProxyMiddleware({
//   target: HOST_URL,
//   changeOrigin: true,
//   pathRewrite: { '^/frontend': '' }
// }))

let riskData;

// ═══════════════════════════════════════════════
//  Fast2SMS — Send SMS to trusted contacts
// ═══════════════════════════════════════════════
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";

async function sendFast2SMS(message, phoneNumber) {
  if (!FAST2SMS_API_KEY) {
    throw new Error("FAST2SMS_API_KEY not configured in .env");
  }

  console.log(`📤 Sending SMS via Fast2SMS to: ${phoneNumber}`);
  console.log(`📝 Message: ${message.substring(0, 80)}...`);

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      "authorization": FAST2SMS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "q",
      message: message,
      language: "english",
      flash: 0,
      numbers: phoneNumber,
    }),
  });

  const data = await res.json();
  console.log(`📨 Fast2SMS full response:`, JSON.stringify(data, null, 2));

  if (data.return === true) {
    console.log(`✅ SMS DELIVERED successfully to: ${phoneNumber}`);
    return { success: true, data };
  }

  // SMS failed — throw with the exact error
  const errorMsg = data.message || data.status_code || JSON.stringify(data);
  console.error(`❌ SMS FAILED: ${errorMsg}`);
  throw new Error(errorMsg);
}

// MongoDB client for district queries
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const mongoClient = new MongoClient(mongoUri);

// pre-load risk data on server start
(async () => {
  try {
    riskData = await loadRisk();
    console.log("Risk data initialized");
  } catch (e) {
    console.error("Failed to initialize risk data", e);
  }
})();

// initialize risk data
app.get("/api/init-risk", async (req, res) => {
  try {
    riskData = await loadRisk();
    res.json({ status: "Risk ready" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/districts?state=tamilnadu|karnataka ──
app.get("/api/districts", async (req, res) => {
  const state = (req.query.state || "").toLowerCase().trim();
  const validStates = ["tamilnadu", "karnataka"];
  if (!validStates.includes(state)) {
    return res.json({ states: validStates });
  }
  try {
    await mongoClient.connect();
    const policeDB = mongoClient.db("policeDB");
    const docs = await policeDB.collection(state).find({}, { projection: { district: 1, _id: 0 } }).toArray();
    const districts = docs.map(d => d.district).filter(Boolean).sort();
    res.json({ state, districts });
  } catch (e) {
    const tnDistricts = [
      "Chennai", "Kanchipuram", "Tiruvallur", "Chengalpattu", "Vellore",
      "Tiruvannamalai", "Villupuram", "Cuddalore", "Salem", "Namakkal",
      "Erode", "Coimbatore", "Tirupur", "Nilgiris", "Krishnagiri", "Dharmapuri",
      "Tiruchirappalli", "Thanjavur", "Nagapattinam", "Pudukkottai", "Dindigul",
      "Madurai", "Theni", "Sivagangai", "Virudhunagar", "Ramanathapuram",
      "Thoothukudi", "Tirunelveli", "Kanyakumari"
    ];
    const kaDistricts = [
      "Bengaluru City", "Bengaluru Rural", "Ramanagara", "Tumakuru", "Kolar",
      "Chikkaballapura", "Mandya", "Mysuru", "Chamarajanagar", "Hassan",
      "Kodagu", "Chikkamagaluru", "Shimoga", "Davangere", "Chitradurga",
      "Bellary", "Haveri", "Dharwad", "Belagavi", "Gadag", "Bagalkot",
      "Koppal", "Raichur", "Yadgir", "Kalaburagi", "Bidar", "Udupi", "Dakshina Kannada"
    ];
    const fallback = state === "tamilnadu" ? tnDistricts : kaDistricts;
    res.json({ state, districts: fallback.sort() });
  }
});

// haversine helper (km)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// nearest district from GPS coordinates
app.get("/api/nearest-district", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "lat and lng required" });
  let best = null, bestDist = Infinity;
  for (const [name, [dlat, dlng]] of Object.entries(districtCoords)) {
    const d = haversine(lat, lng, dlat, dlng);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  res.json({ district: best, distanceKm: Math.round(bestDist * 10) / 10 });
});

// route calculation
app.post("/api/safe-route", async (req, res) => {
  const { from, to } = req.body;
  if (!riskData)
    return res.status(400).json({ error: "Initialize risk first" });
  const routes = multiSafePaths(from, to, riskData, 3);
  res.json({ routes });
});

// ═══════════════════════════════════════════════
//   TRUSTED CONTACTS API (Firestore)
// ═══════════════════════════════════════════════

// GET  — fetch all trusted contacts for a user
app.get("/api/trusted-contacts", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.json({ contacts: [] });
    const uid = snap.docs[0].id;
    const contactsSnap = await db.collection("users").doc(uid)
      .collection("trustedContacts").orderBy("createdAt", "desc").get();
    const contacts = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ contacts });
  } catch (e) {
    console.error("GET trusted-contacts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST — add a new trusted contact
app.post("/api/trusted-contacts", async (req, res) => {
  const { email, contactName, contactPhone, contactRelation } = req.body;
  if (!email || !contactName || !contactPhone)
    return res.status(400).json({ error: "email, contactName, contactPhone required" });
  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.status(404).json({ error: "User not found" });
    const uid = snap.docs[0].id;
    const docRef = await db.collection("users").doc(uid)
      .collection("trustedContacts").add({
        name: contactName,
        phone: contactPhone,
        relation: contactRelation || "Other",
        createdAt: new Date(),
      });
    console.log("✅ Contact saved:", contactName, contactPhone);
    res.json({ success: true, id: docRef.id });
  } catch (e) {
    console.error("POST trusted-contacts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE — remove a trusted contact
app.delete("/api/trusted-contacts", async (req, res) => {
  const { email, contactId } = req.body;
  if (!email || !contactId)
    return res.status(400).json({ error: "email and contactId required" });
  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.status(404).json({ error: "User not found" });
    const uid = snap.docs[0].id;
    await db.collection("users").doc(uid)
      .collection("trustedContacts").doc(contactId).delete();
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE trusted-contacts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//   LIVE TRACKING API
// ═══════════════════════════════════════════════

// POST — share live location with trusted contacts
app.post("/api/share-location", async (req, res) => {
  const { email, lat, lng } = req.body;
  if (!email || !lat || !lng)
    return res.status(400).json({ error: "email, lat, lng required" });
  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.status(404).json({ error: "User not found" });
    const uid = snap.docs[0].id;
    const userData = snap.docs[0].data();
    // Save live location
    await db.collection("users").doc(uid).update({
      lastLocation: { lat, lng, updatedAt: new Date() }
    });
    // Get trusted contacts
    const contactsSnap = await db.collection("users").doc(uid)
      .collection("trustedContacts").get();
    const contacts = contactsSnap.docs.map(doc => doc.data());
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    // ── Send SMS via Fast2SMS to each trusted contact ──
    const smsMessage = `SOS ALERT from ${userData.fullname || "User"}! Live location: ${googleMapsLink} - Please check on me immediately!`;
    const smsResults = [];

    for (const c of contacts) {
      const phone = (c.phone || "").replace(/[^0-9]/g, "");
      const num = phone.length > 10 ? phone.slice(-10) : phone;
      if (num.length === 10) {
        try {
          const smsRes = await sendFast2SMS(smsMessage, num);
          smsResults.push({ name: c.name, phone: num, sent: true });
          console.log(`✅ SMS sent to ${c.name} (${num})`);
        } catch (e) {
          smsResults.push({ name: c.name, phone: num, sent: false, error: e.message });
          console.warn(`⚠️ SMS failed for ${c.name}: ${e.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Location shared with ${contacts.length} contact(s). SMS sent to ${smsResults.filter(r => r.sent).length}.`,
      contacts: contacts.map(c => ({ name: c.name, phone: c.phone })),
      smsResults,
      locationLink: googleMapsLink,
      userName: userData.fullname || "User",
    });
  } catch (e) {
    console.error("share-location error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//   SOS ALERT — Emergency SMS to all contacts
// ═══════════════════════════════════════════════

app.post("/api/sos-alert", async (req, res) => {
  const { email, lat, lng } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty) return res.status(404).json({ error: "User not found" });

    const uid = snap.docs[0].id;
    const userData = snap.docs[0].data();
    const userName = userData.fullname || "User";

    // Get trusted contacts
    const contactsSnap = await db.collection("users").doc(uid)
      .collection("trustedContacts").get();
    const contacts = contactsSnap.docs.map(doc => doc.data());

    if (contacts.length === 0) {
      return res.json({ success: false, message: "No trusted contacts found. Add contacts first." });
    }

    // Build SOS message
    const locationPart = (lat && lng)
      ? `Live Location: https://www.google.com/maps?q=${lat},${lng}`
      : "Location unavailable";

    const sosMessage = `EMERGENCY SOS! ${userName} is in DANGER and needs help NOW! ${locationPart} - Time: ${new Date().toLocaleString("en-IN")} - Please call or reach out immediately!`;

    // Save SOS event to Firestore
    await db.collection("users").doc(uid).collection("sosAlerts").add({
      lat: lat || null,
      lng: lng || null,
      timestamp: new Date(),
      contactsNotified: contacts.length,
    });

    if (lat && lng) {
      await db.collection("users").doc(uid).update({
        lastLocation: { lat, lng, updatedAt: new Date() },
        lastSOS: new Date(),
      });
    }

    // Send SMS to all contacts via Fast2SMS
    const smsResults = [];
    const phoneNumbers = [];

    for (const c of contacts) {
      const phone = (c.phone || "").replace(/[^0-9]/g, "");
      const num = phone.length > 10 ? phone.slice(-10) : phone;
      if (num.length === 10) {
        phoneNumbers.push(num);
        smsResults.push({ name: c.name, phone: num });
      }
    }

    let smsSent = 0;
    let smsError = null;

    if (phoneNumbers.length > 0 && FAST2SMS_API_KEY) {
      try {
        // Send to all numbers at once (Fast2SMS supports comma-separated)
        const result = await sendFast2SMS(sosMessage, phoneNumbers.join(","));
        smsSent = phoneNumbers.length;
        console.log(`🚨 ✅ SOS SMS DELIVERED to ${smsSent} contacts for ${userName}`);
      } catch (e) {
        smsError = e.message;
        console.error(`🚨 ❌ SOS SMS FAILED: ${e.message}`);
      }
    } else if (!FAST2SMS_API_KEY) {
      smsError = "FAST2SMS_API_KEY not configured in .env file";
    }

    const locationLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

    // Build response with REAL status
    const response = {
      success: true,
      smsSent,
      smsError: smsError || null,
      smsDelivered: smsSent > 0,
      contactsNotified: smsResults,
      locationLink,
      userName,
      sosMessage,
      timestamp: new Date().toLocaleString("en-IN"),
    };

    if (smsSent > 0) {
      response.message = `✅ SMS delivered to ${smsSent} contact(s) successfully!`;
    } else if (smsError) {
      response.message = `⚠️ SMS sending failed: ${smsError}`;
    } else {
      response.message = `No valid phone numbers found.`;
    }

    console.log(`📋 SOS Response:`, JSON.stringify(response, null, 2));
    res.json(response);

  } catch (e) {
    console.error("SOS alert error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
//   AUTH ROUTES
// ═══════════════════════════════════════════════

// sign up
app.post("/user/register", async (req, res) => {
  const { fullname, email, phone } = req.body;
  const password = await bcrypt.hash(req.body.password, 10);
  try {
    const userRecord = await auth.createUser({
      email,
      password: req.body.password,
      displayName: fullname,
      phoneNumber: phone
    });
    await db.collection("users").doc(userRecord.uid).set({
      fullname, email,
      hashedPassword: password,
      phone: phone,
      createdAt: new Date(),
    });
    res.render("loginhome", { userEmail: email, userName: fullname });
  } catch (e) {
    res.render("errors/user.already.exist");
  }
})

// login
app.post("/user/login", async function (req, res) {
  const email = req.body.email;
  const password = req.body.password;
  const status = await db.collection('users').where("email", "==", email).get()
  if (status.empty) {
    return res.status(404).render("errors/user.not.found");
  }
  const userData = status.docs[0].data()
  const isMatch = await bcrypt.compare(password, userData.hashedPassword);
  if (isMatch) {
    res.render("loginhome", { userEmail: email, userName: userData.fullname || "User" });
  } else {
    res.status(404).render("errors/invalid.credentials");
  }
})
// listening port
app.listen(PORT, () => console.log("Server is running on port ", PORT))