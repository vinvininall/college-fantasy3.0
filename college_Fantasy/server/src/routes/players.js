import { Router } from "express";
import mongoose from "mongoose";
import Player, { positions } from "../models/Player.js";
import { deletePlayer, getPlayer, updatePlayer } from "../controllers/playerController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.position) {
      if (typeof req.query.position !== "string") {
        return res.status(400).json({ message: "Position must be a single value: GK, DEF, MID, or FWD." });
      }
      const position = String(req.query.position).toUpperCase();
      if (!positions.includes(position)) {
        return res.status(400).json({ message: "Position must be GK, DEF, MID, or FWD." });
      }
      filter.position = position;
    }
    if (req.query.teamId) {
      if (typeof req.query.teamId !== "string" || !mongoose.isObjectIdOrHexString(req.query.teamId)) {
        return res.status(400).json({ message: "teamId must be a valid MongoDB ID." });
      }
      filter.teamId = req.query.teamId;
    }
    const players = await Player.find(filter)
      .populate({
        path: "teamId",
        select: "name shortName tournamentId",
        populate: { path: "tournamentId", select: "name footballFormat" }
      })
      .sort({ name: 1 })
      .lean();
    return res.json({ players });
  } catch (error) {
    return next(error);
  }
});

router.get("/:playerId", getPlayer);
router.put("/:playerId", requireAuth, requireRole("admin"), updatePlayer);
router.delete("/:playerId", requireAuth, requireRole("admin"), deletePlayer);

export default router;
