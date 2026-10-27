import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import teamRoutes from "./routes/teams.js";
import playerRoutes from "./routes/players.js";
import tournamentRoutes from "./routes/tournaments.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/tournaments", tournamentRoutes);

// Serve the production frontend from the same origin as the API.
const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(resolve(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/") || extname(req.path)) {
      return next();
    }
    return res.sendFile(resolve(clientDist, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint not found." });
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  console.error("API request failed:", error.message);
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

export default app;
