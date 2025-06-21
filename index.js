// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "./firebase-admin.js";
import { connectDB } from "./db.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.post("/api/auth/google", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decoded;

    let user = await User.findOne({ uid });

    if (!user) {
      user = await User.create({
        uid,
        name,
        email,
        photo: picture,
      });
      console.log("👤 New user created:", user.name);
    } else {
      console.log("🙋 Existing user logged in:", user.name);
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));
