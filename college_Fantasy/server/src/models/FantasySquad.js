import mongoose from "mongoose";

const fantasySquadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true },
  playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  startingPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
  viceCaptainId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null }
}, { timestamps: true });

fantasySquadSchema.index({ userId: 1, tournamentId: 1 }, { unique: true });

export default mongoose.model("FantasySquad", fantasySquadSchema);
