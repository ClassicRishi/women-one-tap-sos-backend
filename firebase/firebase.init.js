var admin = require("firebase-admin");
require("dotenv").config({ path: ".env", quiet: true })

var serviceAccount = require("./serviceaccount.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore()
const auth = admin.auth()

module.exports = {
    db: db,
    auth: auth
}