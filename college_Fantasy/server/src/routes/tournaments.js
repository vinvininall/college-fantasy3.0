import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createTournament, getTournament, listTournamentFormats, listTournaments } from "../controllers/tournamentController.js";
import { createTournamentTeam, listTournamentTeams } from "../controllers/teamController.js";
import {
  addSquadPlayer,
  createMySquad,
  getMySquad,
  removeSquadPlayer,
  updateSquadCaptain,
  updateSquadLineup
} from "../controllers/squadController.js";

const router = Router();

router.use(requireAuth);
router.get("/formats", listTournamentFormats);
router.get("/:tournamentId/my-squad", getMySquad);
router.post("/:tournamentId/my-squad", createMySquad);
router.post("/:tournamentId/my-squad/players", addSquadPlayer);
router.delete("/:tournamentId/my-squad/players/:playerId", removeSquadPlayer);
router.put("/:tournamentId/my-squad/lineup", updateSquadLineup);
router.put("/:tournamentId/my-squad/captain", updateSquadCaptain);
router.get("/:tournamentId/teams", listTournamentTeams);
router.post("/:tournamentId/teams", requireRole("admin"), createTournamentTeam);
router.get("/", listTournaments);
router.get("/:id", getTournament);
router.post("/", requireRole("admin"), createTournament);

export default router;
