import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

const port = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a secret of at least 32 characters.");
}

try {
  await connectDatabase();
  app.listen(port, () => console.log(`SFL Fantasy API listening on http://localhost:${port}`));
} catch (error) {
  console.error("Unable to start API:", error.message);
  process.exitCode = 1;
}
