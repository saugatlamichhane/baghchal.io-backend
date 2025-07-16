import express from "express";
import Challenge from "../models/Challenge.js";
import User from "../models/User.js";

const router = express.Router();

// Create a challenge
router.post("/", async (req, res) => {
  const { challengerUid, challengedUid } = req.body;
  try {
    const challenge = new Challenge({ challengerUid, challengedUid });
    await challenge.save();
    res.status(201).json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: "Error creating challenge" });
  }
});

// Get all pending and ongoing challenges for a user
router.get("/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const challenges = await Challenge.find({
      $or: [{ challengerUid: uid }, { challengedUid: uid }],
      status: { $in: ["pending", "accepted", "in_progress"] }
    }).sort({ updatedAt: -1 });

    res.json({ success: true, challenges });
  } catch (err) {
    res.status(500).json({ error: "Error fetching challenges" });
  }
});

// Accept challenge
router.post("/accept", async (req, res) => {
  const { challengeId } = req.body;
  try {
    const challenge = await Challenge.findByIdAndUpdate(challengeId, { status: "accepted" }, { new: true });
    res.json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept challenge" });
  }
});

// Complete challenge & update stats
router.post("/complete", async (req, res) => {
  const { challengeId, winnerUid } = req.body;

  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    challenge.status = "completed";
    challenge.result = winnerUid === "draw" ? "draw" : winnerUid;
    await challenge.save();

    // Update stats
    const challenger = await User.findOne({ uid: challenge.challengerUid });
    const challenged = await User.findOne({ uid: challenge.challengedUid });

    const updateStats = (player, isWinner) => {
      player.gamesPlayed = (player.gamesPlayed || 0) + 1;
      player.elo = (player.elo || 1000) + (isWinner ? 25 : -15);
      player.wins = (player.wins || 0) + (isWinner ? 1 : 0);
      player.losses = (player.losses || 0) + (!isWinner && winnerUid !== "draw" ? 1 : 0);
    };

    if (winnerUid === "draw") {
      challenger.gamesPlayed = (challenger.gamesPlayed || 0) + 1;
      challenged.gamesPlayed = (challenged.gamesPlayed || 0) + 1;
    } else {
      updateStats(challenger, winnerUid === challenger.uid);
      updateStats(challenged, winnerUid === challenged.uid);
    }

    await challenger.save();
    await challenged.save();

    res.json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete challenge" });
  }
});

export default router;
