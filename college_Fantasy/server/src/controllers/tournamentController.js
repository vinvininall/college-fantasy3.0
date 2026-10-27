import mongoose from "mongoose";
import Team from "../models/Team.js";
import Tournament, { tournamentFormats } from "../models/Tournament.js";

function validationMessage(error) {
  return Object.values(error.errors).map(({ message }) => message).join(" ");
}

function toTournamentObject(tournament) {
  const record = typeof tournament.toObject === "function" ? tournament.toObject() : tournament;
  const playersPerSide = tournamentFormats[record.format]?.playersPerSide ?? record.playersOnField;
  const fantasySquadSize = record.fantasySquadSize ?? record.squadSize;
  const substitutes = record.substitutes ?? 0;

  return {
    ...record,
    footballFormat: record.footballFormat ?? { name: record.format, playersPerSide },
    fantasyBudget: record.fantasyBudget ?? record.budgetConfig?.amount,
    fantasySquadSize,
    startingPlayers: record.startingPlayers ?? Math.max(1, fantasySquadSize - substitutes)
  };
}

async function withTournamentTeams(tournament) {
  const record = toTournamentObject(tournament);
  record.teams = await Team.find({ tournamentId: record._id })
    .select("name shortName logoUrl")
    .sort({ name: 1 })
    .lean();
  return record;
}

export function listTournamentFormats(_req, res) {
  const formats = Object.entries(tournamentFormats).map(([name, settings]) => ({
    name,
    playersPerSide: settings.playersPerSide,
    defaultStartingPlayers: settings.playersPerSide,
    defaultSubstitutes: settings.defaultSubstitutes,
    defaultFantasySquadSize: settings.playersPerSide + settings.defaultSubstitutes
  }));
  return res.json({ formats });
}

export async function createTournament(req, res, next) {
  const body = req.body ?? {};
  const { name, format, substitutes } = body;
  const fantasySquadSize = body.fantasySquadSize ?? body.squadSize;
  const startingPlayers = body.startingPlayers ?? tournamentFormats[format]?.playersPerSide;
  const fantasyBudget = body.fantasyBudget ?? body.budgetConfig?.amount;
  const teamIds = body.teamIds ?? [];

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    return res.status(400).json({ message: "Tournament name must be between 2 and 120 characters." });
  }
  if (typeof format !== "string" || !Object.hasOwn(tournamentFormats, format)) {
    return res.status(400).json({ message: "Format must be 5v5, 6v6, 7v7, 9v9, or 11v11." });
  }
  if (!Number.isSafeInteger(fantasySquadSize) || fantasySquadSize < 1) {
    return res.status(400).json({ message: "Fantasy squad size must be a positive whole number." });
  }
  if (!Number.isSafeInteger(startingPlayers) || startingPlayers < 1) {
    return res.status(400).json({ message: "Starting players must be a positive whole number." });
  }
  if (!Number.isSafeInteger(substitutes) || substitutes < 0) {
    return res.status(400).json({ message: "Substitutes must be a non-negative whole number." });
  }
  if (startingPlayers > fantasySquadSize) {
    return res.status(400).json({ message: "Starting players cannot exceed the fantasy squad size." });
  }
  if (startingPlayers > tournamentFormats[format].playersPerSide) {
    return res.status(400).json({ message: "Starting players cannot exceed the number of players per side." });
  }
  if (startingPlayers + substitutes !== fantasySquadSize) {
    return res.status(400).json({ message: "Starting players and substitutes must add up to the fantasy squad size." });
  }
  if (!Number.isSafeInteger(fantasyBudget) || fantasyBudget < 1) {
    return res.status(400).json({ message: "Fantasy budget must be a positive whole number of rupees." });
  }
  if (!Array.isArray(teamIds) || teamIds.some((id) => !mongoose.isObjectIdOrHexString(id))
    || new Set(teamIds).size !== teamIds.length) {
    return res.status(400).json({ message: "teamIds must be an array of unique valid MongoDB IDs." });
  }

  try {
    if (teamIds.length > 0) {
      const availableTeams = await Team.countDocuments({
        _id: { $in: teamIds },
        $or: [{ tournamentId: { $exists: false } }, { tournamentId: null }]
      });
      if (availableTeams !== teamIds.length) {
        return res.status(409).json({ message: "One or more teams do not exist or already belong to a tournament." });
      }
    }

    const selectedFormat = tournamentFormats[format];
    const tournament = await Tournament.create({
      name: name.trim(),
      format,
      footballFormat: { name: format, playersPerSide: selectedFormat.playersPerSide },
      playersOnField: selectedFormat.playersPerSide,
      fantasyBudget,
      fantasySquadSize,
      startingPlayers,
      substitutes,
      budgetConfig: { type: "PER_TEAM", amount: fantasyBudget },
      squadSize: fantasySquadSize,
      createdBy: req.auth.userId
    });

    try {
      if (teamIds.length > 0) {
        const assignment = await Team.updateMany(
          {
            _id: { $in: teamIds },
            $or: [{ tournamentId: { $exists: false } }, { tournamentId: null }]
          },
          { $set: { tournamentId: tournament._id } }
        );
        if (assignment.modifiedCount !== teamIds.length) {
          throw new Error("One or more teams were assigned to another tournament at the same time.");
        }
      }
      return res.status(201).json({ tournament: await withTournamentTeams(tournament) });
    } catch (error) {
      await Team.updateMany({ tournamentId: tournament._id }, { $unset: { tournamentId: "" } });
      await Tournament.deleteOne({ _id: tournament._id });
      if (error.code === 11000 || error.message.includes("assigned to another tournament")) {
        return res.status(409).json({ message: "One or more teams are already assigned to a tournament." });
      }
      return next(error);
    }
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: validationMessage(error) });
    }
    return next(error);
  }
}

export async function listTournaments(req, res, next) {
  try {
    const records = await Tournament.find()
      .sort({ createdAt: -1 })
      .lean();
    const tournaments = await Promise.all(records.map(withTournamentTeams));
    return res.json({ tournaments });
  } catch (error) {
    return next(error);
  }
}

export async function getTournament(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: "Tournament ID must be a valid MongoDB ID." });
  }

  try {
    const tournament = await Tournament.findById(req.params.id).lean();
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    return res.json({ tournament: await withTournamentTeams(tournament) });
  } catch (error) {
    return next(error);
  }
}
