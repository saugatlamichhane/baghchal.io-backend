import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  uid: { type: String, required: false }, // Optional if anonymous
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 }, // Optional star rating
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Feedback", feedbackSchema);
