import express from "express";
import User from "../models/User.js";

const router = express.Router();

// GET top N players by Elo
router.get("/", async (req, res) => {
  try {
    const topPlayers = await User.find({})
      .sort({ elo: -1 })
      .limit(20)
      .select("name uid photo elo gamesPlayed");
    res.json({ players: topPlayers });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
