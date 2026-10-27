import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import Team from "../models/Team.js";
import Player from "../models/Player.js";
import Tournament from "../models/Tournament.js";

const teams = [
  { name: "Scaler Strikers", shortName: "STR" },
  { name: "Campus United", shortName: "CUN" },
  { name: "Code City FC", shortName: "CCF" },
  { name: "Data Dynamo", shortName: "DYN" }
];

const players = [
  { name: "Aarav Menon", team: "STR", position: "GK", auctionPrice: 120000, jerseyNumber: 1 },
  { name: "Ishaan Rao", team: "STR", position: "DEF", auctionPrice: 90000, jerseyNumber: 4 },
  { name: "Kabir Shah", team: "STR", position: "MID", auctionPrice: 150000, jerseyNumber: 8 },
  { name: "Rohan Das", team: "STR", position: "FWD", auctionPrice: 180000, jerseyNumber: 9 },
  { name: "Neil Kapoor", team: "CUN", position: "GK", auctionPrice: 100000, jerseyNumber: 1 },
  { name: "Dev Malhotra", team: "CUN", position: "DEF", auctionPrice: 110000, jerseyNumber: 5 },
  { name: "Arjun Nair", team: "CUN", position: "MID", auctionPrice: 140000, jerseyNumber: 10 },
  { name: "Vivaan Iyer", team: "CUN", position: "FWD", auctionPrice: 170000, jerseyNumber: 11 },
  { name: "Reyansh Bose", team: "CCF", position: "GK", auctionPrice: 95000, jerseyNumber: 13 },
  { name: "Aditya Sen", team: "CCF", position: "DEF", auctionPrice: 125000, jerseyNumber: 3 },
  { name: "Samar Kulkarni", team: "CCF", position: "MID", auctionPrice: 160000, jerseyNumber: 7 },
  { name: "Krish Patel", team: "CCF", position: "FWD", auctionPrice: 200000, jerseyNumber: 17 },
  { name: "Atharv Joshi", team: "DYN", position: "GK", auctionPrice: 105000, jerseyNumber: 22 },
  { name: "Dhruv Verma", team: "DYN", position: "DEF", auctionPrice: 115000, jerseyNumber: 2 },
  { name: "Ayaan Khanna", team: "DYN", position: "MID", auctionPrice: 155000, jerseyNumber: 6 },
  { name: "Vihaan Reddy", team: "DYN", position: "FWD", auctionPrice: 190000, jerseyNumber: 19 }
];

try {
  const tournamentId = process.argv[2] ?? process.env.SEED_TOURNAMENT_ID;
  if (!tournamentId || !mongoose.isObjectIdOrHexString(tournamentId)) {
    throw new Error("Provide a tournament ID as an argument or set SEED_TOURNAMENT_ID in server/.env.");
  }
  await connectDatabase();
  const tournament = await Tournament.findById(tournamentId).select("_id").lean();
  if (!tournament) {
    throw new Error("The selected tournament does not exist. Create a tournament first and use its MongoDB ID.");
  }
  for (const team of teams) {
    await Team.updateOne(
      { tournamentId: tournament._id, shortName: team.shortName },
      { $setOnInsert: { ...team, tournamentId: tournament._id } },
      { upsert: true }
    );
  }
  const storedTeams = await Team.find({
    tournamentId: tournament._id,
    shortName: { $in: teams.map(({ shortName }) => shortName) }
  });
  const teamIds = new Map(storedTeams.map((team) => [team.shortName, team._id]));
  for (const player of players) {
    const { team, ...details } = player;
    const teamId = teamIds.get(team);
    if (!teamId) {
      throw new Error(`Could not find seeded team "${team}" for player "${details.name}".`);
    }
    await Player.updateOne(
      { name: details.name, teamId },
      { $setOnInsert: { ...details, fantasyPrice: details.auctionPrice, teamId } },
      { upsert: true }
    );
  }
  console.log(`Loaded ${teams.length} fictional demo teams and ${players.length} fictional demo players into tournament ${tournament._id} (existing records preserved).`);
} catch (error) {
  console.error("Unable to seed sample data:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
