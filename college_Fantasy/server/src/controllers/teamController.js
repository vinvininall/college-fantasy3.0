import mongoose from "mongoose";
import Player from "../models/Player.js";
import Team from "../models/Team.js";
import Tournament from "../models/Tournament.js";

function invalidId(res, label) {
  return res.status(400).json({ message: `${label} must be a valid MongoDB ID.` });
}

function validationMessage(error) {
  return Object.values(error.errors).map(({ message }) => message).join(" ");
}

function teamFields(body, { partial = false } = {}) {
  const fields = {};
  if (!partial || Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return { error: "Team name is required and must be 100 characters or fewer." };
    }
    fields.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, "shortName")) {
    if (typeof body.shortName !== "string" || !/^[a-z0-9]{2,6}$/i.test(body.shortName.trim())) {
      return { error: "Team short name must be 2 to 6 letters or numbers." };
    }
    fields.shortName = body.shortName.trim().toUpperCase();
  }
  if (Object.hasOwn(body, "logoUrl")) {
    if (typeof body.logoUrl !== "string" || (body.logoUrl && !/^https?:\/\/\S+$/i.test(body.logoUrl.trim()))) {
      return { error: "Logo URL must be a valid HTTP or HTTPS URL." };
    }
    fields.logoUrl = body.logoUrl.trim();
  }
  return { fields };
}

function handleTeamError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({ message: "A team with this name or short name already exists in this tournament." });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: validationMessage(error) });
  }
  return next(error);
}

export async function listTournamentTeams(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  try {
    const tournamentExists = await Tournament.exists({ _id: req.params.tournamentId });
    if (!tournamentExists) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    const teams = await Team.find({ tournamentId: req.params.tournamentId })
      .populate("tournamentId", "name footballFormat")
      .sort({ name: 1 })
      .lean();
    return res.json({ teams });
  } catch (error) {
    return next(error);
  }
}

export async function createTournamentTeam(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.tournamentId)) {
    return invalidId(res, "Tournament ID");
  }
  const { fields, error } = teamFields(req.body ?? {});
  if (error) {
    return res.status(400).json({ message: error });
  }
  try {
    const tournamentExists = await Tournament.exists({ _id: req.params.tournamentId });
    if (!tournamentExists) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    const team = await Team.create({ ...fields, tournamentId: req.params.tournamentId });
    return res.status(201).json({ team });
  } catch (error) {
    return handleTeamError(error, res, next);
  }
}

export async function getTeam(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.teamId)) {
    return invalidId(res, "Team ID");
  }
  try {
    const team = await Team.findById(req.params.teamId).populate("tournamentId", "name").lean();
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }
    return res.json({ team });
  } catch (error) {
    return next(error);
  }
}

export async function updateTeam(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.teamId)) {
    return invalidId(res, "Team ID");
  }
  if (Object.hasOwn(req.body ?? {}, "tournamentId")) {
    return res.status(400).json({ message: "A team's tournament cannot be changed." });
  }
  const { fields, error } = teamFields(req.body ?? {}, { partial: true });
  if (error) {
    return res.status(400).json({ message: error });
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ message: "Provide at least one team field to update." });
  }
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }
    Object.assign(team, fields);
    await team.save();
    return res.json({ team });
  } catch (error) {
    return handleTeamError(error, res, next);
  }
}

export async function deleteTeam(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.teamId)) {
    return invalidId(res, "Team ID");
  }
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found." });
    }
    const playerCount = await Player.countDocuments({ teamId: team._id });
    if (playerCount > 0) {
      return res.status(409).json({
        message: `This team has ${playerCount} registered player(s). Remove or reassign them before deleting the team.`
      });
    }
    await team.deleteOne();
    return res.json({ message: "Team deleted." });
  } catch (error) {
    return next(error);
  }
}
