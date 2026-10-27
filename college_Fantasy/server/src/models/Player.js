import mongoose from "mongoose";

const positions = ["GK", "DEF", "MID", "FWD"];
const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
  position: { type: String, required: true, enum: positions },
  auctionPrice: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Auction price must be a whole rupee amount." } },
  fantasyPrice: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Fantasy price must be a whole rupee amount." } },
  jerseyNumber: { type: Number, min: 1, max: 99, validate: { validator: Number.isInteger, message: "Jersey number must be a whole number from 1 to 99." } },
  photoUrl: { type: String, trim: true, default: "" }
});

playerSchema.index({ name: 1, teamId: 1 }, { unique: true });

export { positions };
export default mongoose.model("Player", playerSchema);
