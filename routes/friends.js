// routes/friends.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// GET all friends of a user
router.get("/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid }).populate(
      "friends"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ friends: user.friends });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST add a friend
router.post("/", async (req, res) => {
  const { myUid, friendUid } = req.body;
  try {
    const me = await User.findOne({ uid: myUid });
    const friend = await User.findOne({ uid: friendUid });
    if (!me || !friend)
      return res.status(404).json({ error: "User not found" });

    if (!me.friends.includes(friend._id)) {
      me.friends.push(friend._id);
      await me.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE unfriend
router.delete("/", async (req, res) => {
  const { myUid, friendUid } = req.body;
  try {
    const me = await User.findOne({ uid: myUid });
    const friend = await User.findOne({ uid: friendUid });
    if (!me || !friend)
      return res.status(404).json({ error: "User not found" });

    me.friends = me.friends.filter(
      (id) => id.toString() !== friend._id.toString()
    );
    await me.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
