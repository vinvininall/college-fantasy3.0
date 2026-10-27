import mongoose from "mongoose";
import FantasySquad from "../models/FantasySquad.js";
import Player from "../models/Player.js";
import Team from "../models/Team.js";
import Tournament from "../models/Tournament.js";

function invalidId(res, label) {
  return res.status(400).json({ message: `${label} must be a valid MongoDB ID.` });
}

function getTournamentRules(tournament) {
  const squadSize = tournament.fantasySquadSize ?? tournament.squadSize;
  return {
    budget: tournament.fantasyBudget ?? tournament.budgetConfig?.amount,
    squadSize,
    startingPlayers: tournament.startingPlayers
      ?? Math.max(1, squadSize - (tournament.substitutes ?? 0))
  };
}

async function findTournament(tournamentId) {
  if (!mongoose.isObjectIdOrHexString(tournamentId)) return null;
  return Tournament.findById(tournamentId).lean();
}

function hasValidRules(rules) {
  return Number.isSafeInteger(rules.budget) && rules.budget > 0
    && Number.isSafeInteger(rules.squadSize) && rules.squadSize > 0
    && Number.isSafeInteger(rules.startingPlayers) && rules.startingPlayers > 0
    && rules.startingPlayers <= rules.squadSize;
}

async function getCurrentSquadPlayers(squad) {
  const players = await Player.find({ _id: { $in: squad.playerIds } })
    .select("name position fantasyPrice teamId")
    .populate({ path: "teamId", select: "name shortName tournamentId" })
    .lean();
  if (players.length !== squad.playerIds.length) {
    throw new Error("This squad contains a player record that no longer exists. Contact an administrator.");
  }
  if (players.some((player) => !Number.isSafeInteger(player.fantasyPrice) || player.fantasyPrice < 0)) {
    throw new Error("A selected player's fantasy price is invalid. Contact an administrator.");
  }
  return players;
}

async function getSquadResponse(squad, tournament, rules) {
  const players = await getCurrentSquadPlayers(squad);
  const spent = players.reduce((total, player) => total + player.fantasyPrice, 0);
  const startingIds = squad.startingPlayerIds.map(String);
  const complete = players.length === rules.squadSize && startingIds.length === rules.startingPlayers;

  return {
    squad: {
      _id: squad._id,
      userId: squad.userId,
      tournamentId: squad.tournamentId,
      playerIds: players,
      startingPlayerIds: startingIds,
      captainId: squad.captainId?.toString() ?? null,
      viceCaptainId: squad.viceCaptainId?.toString() ?? null,
      createdAt: squad.createdAt,
      updatedAt: squad.updatedAt
    },
    rules,
    summary: {
      selected: players.length,
      squadSize: rules.squadSize,
      starters: startingIds.length,
      requiredStarters: rules.startingPlayers,
      spent,
      remainingBudget: rules.budget - spent,
      complete
    },
    tournament: { _id: tournament._id, name: tournament.name }
  };
}

async function getOwnedSquad(tournamentId, userId) {
  return FantasySquad.findOne({ userId, tournamentId });
}

async function updateWithVersion(squad, update, res) {
  const updated = await FantasySquad.findOneAndUpdate(
    { _id: squad._id, userId: squad.userId, tournamentId: squad.tournamentId, __v: squad.__v },
    { ...update, $inc: { ...(update.$inc ?? {}), __v: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    res.status(409).json({ message: "Your squad changed in another request. Reload it and try again." });
    return null;
  }
  return updated;
}

export async function getMySquad(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const rules = getTournamentRules(tournament);
    if (!hasValidRules(rules)) {
      return res.status(409).json({ message: "This tournament does not have valid fantasy squad rules configured." });
    }
    const squad = await getOwnedSquad(tournament._id, req.auth.userId);
    if (!squad) {
      return res.json({
        squad: null,
        rules,
        summary: {
          selected: 0,
          squadSize: rules.squadSize,
          starters: 0,
          requiredStarters: rules.startingPlayers,
          spent: 0,
          remainingBudget: rules.budget,
          complete: false
        },
        tournament: { _id: tournament._id, name: tournament.name }
      });
    }
    return res.json(await getSquadResponse(squad, tournament, rules));
  } catch (error) {
    return next(error);
  }
}

export async function createMySquad(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const rules = getTournamentRules(tournament);
    if (!hasValidRules(rules)) {
      return res.status(409).json({ message: "This tournament does not have valid fantasy squad rules configured." });
    }
    let squad;
    let created = false;
    try {
      squad = await FantasySquad.create({
        userId: req.auth.userId,
        tournamentId: tournament._id
      });
      created = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      squad = await getOwnedSquad(tournament._id, req.auth.userId);
    }
    if (!squad) {
      return res.status(409).json({ message: "Your squad could not be created. Please try again." });
    }
    return res.status(created ? 201 : 200).json({
      ...(await getSquadResponse(squad, tournament, rules)),
      created
    });
  } catch (error) {
    return next(error);
  }
}

export async function addSquadPlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  if (!mongoose.isObjectIdOrHexString(req.body?.playerId)) {
    return invalidId(res, "Player ID");
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const rules = getTournamentRules(tournament);
    if (!hasValidRules(rules)) {
      return res.status(409).json({ message: "This tournament does not have valid fantasy squad rules configured." });
    }
    const squad = await getOwnedSquad(tournament._id, req.auth.userId);
    if (!squad) return res.status(409).json({ message: "Create your squad before adding players." });
    if (squad.playerIds.some((id) => id.equals(req.body.playerId))) {
      return res.status(409).json({ message: "This player is already in your squad." });
    }
    if (squad.playerIds.length >= rules.squadSize) {
      return res.status(409).json({ message: "Your squad is full." });
    }
    const player = await Player.findById(req.body.playerId).select("fantasyPrice teamId").lean();
    if (!player) return res.status(404).json({ message: "Player not found." });
    const team = await Team.findById(player.teamId).select("tournamentId").lean();
    if (!team || String(team.tournamentId) !== String(tournament._id)) {
      return res.status(400).json({ message: "Choose a player from a team in this tournament." });
    }
    const currentPlayers = await getCurrentSquadPlayers(squad);
    const spent = currentPlayers.reduce((total, item) => total + item.fantasyPrice, 0);
    if (!Number.isSafeInteger(spent + player.fantasyPrice)) {
      return res.status(409).json({ message: "The current squad cost exceeds the supported rupee amount range." });
    }
    if (spent + player.fantasyPrice > rules.budget) {
      return res.status(400).json({ message: "Adding this player would exceed your tournament budget." });
    }
    const updated = await updateWithVersion(
      squad,
      { $addToSet: { playerIds: player._id } },
      res
    );
    if (!updated) return undefined;
    return res.json(await getSquadResponse(updated, tournament, rules));
  } catch (error) {
    return next(error);
  }
}

export async function removeSquadPlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  if (!mongoose.isObjectIdOrHexString(req.params.playerId)) {
    return invalidId(res, "Player ID");
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const squad = await getOwnedSquad(tournament._id, req.auth.userId);
    if (!squad) return res.status(404).json({ message: "Your squad has not been created." });
    if (!squad.playerIds.some((id) => id.equals(req.params.playerId))) {
      return res.status(404).json({ message: "This player is not in your squad." });
    }
    const removePlayer = new mongoose.Types.ObjectId(req.params.playerId);
    const removeCaptain = squad.captainId?.equals(removePlayer);
    const removeViceCaptain = squad.viceCaptainId?.equals(removePlayer);
    const updated = await updateWithVersion(squad, {
      $pull: { playerIds: removePlayer, startingPlayerIds: removePlayer },
      ...(removeCaptain || removeViceCaptain
        ? { $set: {
          ...(removeCaptain ? { captainId: null } : {}),
          ...(removeViceCaptain ? { viceCaptainId: null } : {})
        } }
        : {})
    }, res);
    if (!updated) return undefined;
    return res.json(await getSquadResponse(updated, tournament, getTournamentRules(tournament)));
  } catch (error) {
    return next(error);
  }
}

export async function updateSquadLineup(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  const { startingPlayerIds } = req.body ?? {};
  if (!Array.isArray(startingPlayerIds)
    || startingPlayerIds.some((id) => !mongoose.isObjectIdOrHexString(id))
    || new Set(startingPlayerIds.map(String)).size !== startingPlayerIds.length) {
    return res.status(400).json({ message: "startingPlayerIds must be an array of unique valid player IDs." });
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const rules = getTournamentRules(tournament);
    if (startingPlayerIds.length > rules.startingPlayers) {
      return res.status(400).json({ message: `Your starting lineup can contain at most ${rules.startingPlayers} players.` });
    }
    const squad = await getOwnedSquad(tournament._id, req.auth.userId);
    if (!squad) return res.status(404).json({ message: "Your squad has not been created." });
    const selectedIds = new Set(squad.playerIds.map(String));
    if (startingPlayerIds.some((id) => !selectedIds.has(String(id)))) {
      return res.status(400).json({ message: "Every starter must already be in your squad." });
    }
    const updated = await updateWithVersion(squad, {
      $set: { startingPlayerIds: startingPlayerIds.map((id) => new mongoose.Types.ObjectId(id)) }
    }, res);
    if (!updated) return undefined;
    return res.json(await getSquadResponse(updated, tournament, rules));
  } catch (error) {
    return next(error);
  }
}

export async function updateSquadCaptain(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  const body = req.body ?? {};
  const hasCaptain = Object.hasOwn(body, "captainId");
  const hasViceCaptain = Object.hasOwn(body, "viceCaptainId");
  if ((!hasCaptain && !hasViceCaptain)
    || (hasCaptain && body.captainId !== null && !mongoose.isObjectIdOrHexString(body.captainId))
    || (hasViceCaptain && body.viceCaptainId !== null && !mongoose.isObjectIdOrHexString(body.viceCaptainId))) {
    return res.status(400).json({ message: "Provide a valid captainId and/or viceCaptainId, or null to clear a selection." });
  }
  try {
    const tournament = await findTournament(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const squad = await getOwnedSquad(tournament._id, req.auth.userId);
    if (!squad) return res.status(404).json({ message: "Your squad has not been created." });
    const captainId = hasCaptain ? body.captainId : squad.captainId?.toString() ?? null;
    const viceCaptainId = hasViceCaptain ? body.viceCaptainId : squad.viceCaptainId?.toString() ?? null;
    if (captainId && captainId === viceCaptainId) {
      return res.status(400).json({ message: "Captain and vice-captain must be different players." });
    }
    const selectedIds = new Set(squad.playerIds.map(String));
    if ((captainId && !selectedIds.has(captainId)) || (viceCaptainId && !selectedIds.has(viceCaptainId))) {
      return res.status(400).json({ message: "Captain and vice-captain must already be in your squad." });
    }
    const updated = await updateWithVersion(squad, {
      $set: {
        ...(hasCaptain ? { captainId: captainId ? new mongoose.Types.ObjectId(captainId) : null } : {}),
        ...(hasViceCaptain ? { viceCaptainId: viceCaptainId ? new mongoose.Types.ObjectId(viceCaptainId) : null } : {})
      }
    }, res);
    if (!updated) return undefined;
    return res.json(await getSquadResponse(updated, tournament, getTournamentRules(tournament)));
  } catch (error) {
    return next(error);
  }
}
