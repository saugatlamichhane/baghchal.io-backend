// routes/search.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// GET /api/search?query=<text>
router.get("/", async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    const regex = new RegExp(query, "i"); // case-insensitive search
    const results = await User.find({
      $or: [
        { name: { $regex: regex } },
        { uid: { $regex: regex } },
      ],
    }).select("name uid photo elo");

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
