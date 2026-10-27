import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import Team from "../models/Team.js";

try {
  await connectDatabase();
  const indexes = await Team.collection.indexes();

  for (const indexName of ["name_1", "shortName_1"]) {
    const index = indexes.find((entry) => entry.name === indexName);
    if (index?.unique) {
      await Team.collection.dropIndex(indexName);
      console.log(`Removed legacy global unique index ${indexName}.`);
    }
  }

  await Team.createIndexes();
  console.log("Tournament-scoped unique team indexes are ready. No team records were changed.");
} catch (error) {
  console.error("Unable to update team indexes:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
