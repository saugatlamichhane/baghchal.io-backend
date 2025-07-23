// index.js
import express from "express";
import { createServer } from "http";
import initSocketServer from "./socketServer.js";
import cors from "cors";
import dotenv from "dotenv";
import admin from "./firebase-admin.js";
import { connectDB } from "./db.js";
import User from "./models/User.js";
import profileRoutes from "./routes/profile.js";
import searchRoutes from "./routes/search.js";
import friendsRoutes from "./routes/friends.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import feedbackRoutes from "./routes/feedback.js";
import challengeRoutes from "./routes/challenges.js";

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

app.use("/api", profileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/challenges", challengeRoutes);
const httpServer = createServer(app);
initSocketServer(httpServer);
httpServer.listen(5000, () => console.log("🚀 Server running on port 5000"));
