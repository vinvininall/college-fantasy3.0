import mongoose from "mongoose";

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  shortName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 6,
    match: /^[A-Z0-9]+$/
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    required() { return this.isNew; }
  },
  logoUrl: {
    type: String,
    trim: true,
    default: "",
    validate: {
      validator: (value) => !value || /^https?:\/\/\S+$/i.test(value),
      message: "Logo URL must be a valid HTTP or HTTPS URL."
    }
  }
});

teamSchema.index(
  { tournamentId: 1, name: 1 },
  { unique: true, partialFilterExpression: { tournamentId: { $exists: true } } }
);
teamSchema.index(
  { tournamentId: 1, shortName: 1 },
  { unique: true, partialFilterExpression: { tournamentId: { $exists: true } } }
);

export default mongoose.model("Team", teamSchema);
