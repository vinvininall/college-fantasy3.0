import mongoose from "mongoose";

export async function connectDatabase() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Configure it in server/.env.");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");
}
