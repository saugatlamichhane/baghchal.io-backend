import express from 'express';
import User from '../models/User.js'; // adjust path as needed

const router = express.Router();

// 🧠 GET user profile by UID
router.get("/profile/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      profile: {
        uid: user.uid,
        name: user.name,
        photo: user.photo,
        elo: user.elo,
        stats: user.stats || { wins: 0, losses: 0, draws: 0 }, // default
        // Add more fields if needed
      },
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
