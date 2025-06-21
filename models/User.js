import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  photo: String,
  elo: { type: Number, default: 1000 },
  friends: [{type: mongoose.Schema.Types.ObjectId, ref: "User"}],
  gamesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
});

export default mongoose.model("User", userSchema);
