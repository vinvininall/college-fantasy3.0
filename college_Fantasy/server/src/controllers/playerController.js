import mongoose from "mongoose";
import Player, { positions } from "../models/Player.js";
import Team from "../models/Team.js";

function invalidId(res, label) {
  return res.status(400).json({ message: `${label} must be a valid MongoDB ID.` });
}

function validationMessage(error) {
  return Object.values(error.errors).map(({ message }) => message).join(" ");
}

function playerFields(body, { partial = false } = {}) {
  const fields = {};
  if (!partial || Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return { error: "Player name is required and must be 100 characters or fewer." };
    }
    fields.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, "position")) {
    if (typeof body.position !== "string" || !positions.includes(body.position)) {
      return { error: "Position must be GK, DEF, MID, or FWD." };
    }
    fields.position = body.position;
  }
  for (const field of ["auctionPrice", "fantasyPrice"]) {
    if (!partial || Object.hasOwn(body, field)) {
      if (!Number.isSafeInteger(body[field]) || body[field] < 0) {
        return { error: `${field} must be a non-negative whole number of rupees.` };
      }
      fields[field] = body[field];
    }
  }
  if (Object.hasOwn(body, "jerseyNumber")) {
    if (body.jerseyNumber === null || body.jerseyNumber === "") {
      fields.jerseyNumber = undefined;
    } else if (!Number.isSafeInteger(body.jerseyNumber) || body.jerseyNumber < 1 || body.jerseyNumber > 99) {
      return { error: "Jersey number must be a whole number from 1 to 99." };
    } else {
      fields.jerseyNumber = body.jerseyNumber;
    }
  }
  if (Object.hasOwn(body, "photoUrl")) {
    if (typeof body.photoUrl !== "string" || (body.photoUrl && !/^https?:\/\/\S+$/i.test(body.photoUrl.trim()))) {
      return { error: "Photo URL must be a valid HTTP or HTTPS URL." };
    }
    fields.photoUrl = body.photoUrl.trim();
  }
  return { fields };
}

function populateTeam(query) {
  return query.populate({
    path: "teamId",
    select: "name shortName tournamentId",
    populate: { path: "tournamentId", select: "name footballFormat" }
  });
}

function handlePlayerError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({ message: "A player with this name is already registered for this team." });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: validationMessage(error) });
  }
  return next(error);
}

export async function listTeamPlayers(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.teamId)) {
    return invalidId(res, "Team ID");
  }
  if (req.query.position !== undefined
    && (typeof req.query.position !== "string" || !positions.includes(req.query.position))) {
    return res.status(400).json({ message: "Position must be GK, DEF, MID, or FWD." });
  }
  try {
    const teamExists = await Team.exists({ _id: req.params.teamId });
    if (!teamExists) {
      return res.status(404).json({ message: "Team not found." });
    }
    const filter = { teamId: req.params.teamId };
    if (req.query.position) {
      filter.position = req.query.position;
    }
    const players = await populateTeam(Player.find(filter).sort({ name: 1 })).lean();
    return res.json({ players });
  } catch (error) {
    return next(error);
  }
}

export async function createTeamPlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.teamId)) {
    return invalidId(res, "Team ID");
  }
  if (Object.hasOwn(req.body ?? {}, "teamId")) {
    return res.status(400).json({ message: "The player team is determined by the team URL." });
  }
  const { fields, error } = playerFields(req.body ?? {});
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }
    if (!team.tournamentId) {
      return res.status(409).json({ message: "Assign this team to a tournament before registering players." });
    }
    const [player] = await Player.create([{ ...fields, teamId: team._id }]);
    await player.populate({
      path: "teamId",
      select: "name shortName tournamentId",
      populate: { path: "tournamentId", select: "name footballFormat" }
    });
    return res.status(201).json({ player });
  } catch (error) {
    return handlePlayerError(error, res, next);
  }
}

export async function getPlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.playerId)) {
    return invalidId(res, "Player ID");
  }
  try {
    const player = await populateTeam(Player.findById(req.params.playerId)).lean();
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }
    return res.json({ player });
  } catch (error) {
    return next(error);
  }
}

export async function updatePlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.playerId)) {
    return invalidId(res, "Player ID");
  }
  if (Object.hasOwn(req.body ?? {}, "teamId")) {
    return res.status(400).json({ message: "A player's team cannot be changed here." });
  }
  const { fields, error } = playerFields(req.body ?? {}, { partial: true });
  if (error) {
    return res.status(400).json({ message: error });
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ message: "Provide at least one player field to update." });
  }
  try {
    const player = await Player.findById(req.params.playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }
    Object.assign(player, fields);
    await player.save();
    await player.populate({
      path: "teamId",
      select: "name shortName tournamentId",
      populate: { path: "tournamentId", select: "name footballFormat" }
    });
    return res.json({ player });
  } catch (error) {
    return handlePlayerError(error, res, next);
  }
}

export async function deletePlayer(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.playerId)) {
    return invalidId(res, "Player ID");
  }
  try {
    const exists = await Player.exists({ _id: req.params.playerId });
    if (!exists) {
      return res.status(404).json({ message: "Player not found." });
    }
    return res.status(409).json({
      message: "Player deletion is disabled because this project has no fantasy-squad or match-history records to verify that deletion is safe."
    });
  } catch (error) {
    return next(error);
  }
}
