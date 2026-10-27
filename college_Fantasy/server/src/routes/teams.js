import { Router } from "express";
import mongoose from "mongoose";
import Team from "../models/Team.js";
import { createTeamPlayer, listTeamPlayers } from "../controllers/playerController.js";
import { deleteTeam, getTeam, updateTeam } from "../controllers/teamController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.tournamentId) {
      if (typeof req.query.tournamentId !== "string" || !mongoose.isObjectIdOrHexString(req.query.tournamentId)) {
        return res.status(400).json({ message: "tournamentId must be a valid MongoDB ID." });
      }
      filter.tournamentId = req.query.tournamentId;
    }
    if (req.query.unassigned === "true") {
      filter.$or = [{ tournamentId: { $exists: false } }, { tournamentId: null }];
    }
    const teams = await Team.find(filter).populate("tournamentId", "name").sort({ name: 1 }).lean();
    return res.json({ teams });
  } catch (error) {
    next(error);
  }
});

router.get("/:teamId/players", listTeamPlayers);
router.post("/:teamId/players", requireAuth, requireRole("admin"), createTeamPlayer);
router.get("/:teamId", getTeam);
router.put("/:teamId", requireAuth, requireRole("admin"), updateTeam);
router.delete("/:teamId", requireAuth, requireRole("admin"), deleteTeam);

export default router;
