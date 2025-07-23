import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
  {
    challengerUid: { type: String, required: true },
    challengedUid: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "in_progress", "completed", "rejected"],
      default: "pending",
    },
    result: {
      type: String,
      enum: ["challenger", "challenged", "draw", null],
      default: null,
    },
    board: {
      goats: [{ row: Number, col: Number }],
      tigers: [{ row: Number, col: Number }],
      goatsKilled: { type: Number, default: 0 },
    },
    turn: { type: String, enum: ["goat", "tiger"], default: "goat" },
  },
  { timestamps: true }
);

export default mongoose.model("Challenge", challengeSchema);
