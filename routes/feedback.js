import express from "express";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// POST /api/feedback - Save feedback
router.post("/", async (req, res) => {
  try {
    const { uid, message, rating } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Feedback message required." });
    }

    const feedback = new Feedback({ uid, message, rating });
    await feedback.save();

    res.status(201).json({ success: true, message: "Feedback submitted!" });
  } catch (err) {
    console.error("❌ Error saving feedback:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
