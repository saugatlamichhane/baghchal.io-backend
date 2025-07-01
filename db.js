// db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {                // omit if already in the URI
      serverSelectionTimeoutMS: 10000,  // optional: 10 s fail-fast
    });
    console.log('✅ MongoDB connected!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);                    // stop nodemon crash loops
  }
};
