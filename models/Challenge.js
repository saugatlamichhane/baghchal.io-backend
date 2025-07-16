import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema({
  challengerUid: { type: String, required: true },
  challengedUid: { type: String, required: true },
  status: { type: String, enum: ["pending", "accepted", "in_progress", "completed", "rejected"], default: "pending" },
  result: { type: String, enum: ["challenger", "challenged", "draw", null], default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Challenge", challengeSchema);
