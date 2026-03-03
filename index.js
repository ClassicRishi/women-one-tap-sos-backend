const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: ".env", quiet: true })
const { db, auth } = require("./firebase/firebase.init.js")
const bcrypt = require("bcrypt");

// set up middleware
const app = express();
const PORT = process.env.PORT;
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "pug")

// sign in route getting from frontend
app.post("/user/register", async (req, res) => {
    const { fullname, email, phone } = req.body;
    const password = await bcrypt.hash(req.body.password,10);

    try {
        const userRecord = await auth.createUser({
            fullname,email
        });
        await db.collection("users").doc(userRecord.uid).set({
            fullname,
            email,
            hashedPassword: password,
            phone: phone,
            createdAt: new Date(),
        });

        res.render("loginhome.pug");
    } catch(e) {
        res.render("errors/user.already.exist.pug");
    }
})


// handle user login or sign in route getting from frontend
app.post("/user/login", async function(req, res) {
    const email = req.body.email;
    const password = req.body.password;
    const status = await db.collection('users').where("email","==",email).get()

    if(status.empty) {
        return res.status(404).render("errors/user.not.found.pug");
    }
    const userData = status.docs[0].data()
    const isMatch = await bcrypt.compare(password, userData.hashedPassword);

    if(isMatch) {
        res.render("loginhome.pug");
    } else {
        res.status(404).render("errors/invalid.credentials.pug");
    }
})

// listening port
app.listen(PORT, () => console.log("Server is running on port ",PORT))