import express from "express";
import Challenge from "../models/Challenge.js";
import User from "../models/User.js";

const router = express.Router();

// 📌 Create a new challenge
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

// 📌 Get all pending and ongoing challenges for a user
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

// 📌 Accept a challenge → set to "in_progress" and init board
router.post("/accept", async (req, res) => {
  const { challengeId } = req.body;
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      challengeId,
      {
        status: "in_progress",
        turn: "goat",
        board: {
          goats: [],
          tigers: [
            { row: 1, col: 1 },
            { row: 1, col: 5 },
            { row: 5, col: 1 },
            { row: 5, col: 5 }
          ],
          goatsKilled: 0
        }
      },
      { new: true }
    );

    res.json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept challenge" });
  }
});

// 📌 Resume an ongoing challenge (load state)
router.get("/resume/:challengeId", async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.challengeId);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    if (challenge.status !== "in_progress") {
      return res.status(400).json({ error: "Challenge is not in progress" });
    }

    res.json({
      success: true,
      board: challenge.board,
      turn: challenge.turn,
      challengeId: challenge._id,
      challengerUid: challenge.challengerUid,
      challengedUid: challenge.challengedUid
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to resume challenge" });
  }
});

// 📌 Complete challenge and update stats
router.post("/complete", async (req, res) => {
  const { challengeId, winnerUid } = req.body;

  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    challenge.status = "completed";
    challenge.result = winnerUid === "draw" ? "draw" : winnerUid;
    await challenge.save();

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
