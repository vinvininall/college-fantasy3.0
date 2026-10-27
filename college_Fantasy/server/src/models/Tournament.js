import mongoose from "mongoose";

export const tournamentFormats = {
  "5v5": { playersPerSide: 5, defaultSubstitutes: 3 },
  "6v6": { playersPerSide: 6, defaultSubstitutes: 3 },
  "7v7": { playersPerSide: 7, defaultSubstitutes: 3 },
  "9v9": { playersPerSide: 9, defaultSubstitutes: 3 },
  "11v11": { playersPerSide: 11, defaultSubstitutes: 3 }
};

const footballFormatSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, enum: Object.keys(tournamentFormats) },
    playersPerSide: { type: Number, required: true, min: 5, max: 11 }
  },
  { _id: false }
);

const budgetConfigSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["PER_TEAM"] },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Budget amount must be a positive whole number of rupees."
      }
    }
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  format: { type: String, required: true, enum: Object.keys(tournamentFormats) },
  footballFormat: { type: footballFormatSchema, required() { return this.isNew; } },
  playersOnField: {
    type: Number,
    required: true,
    validate: {
      validator(value) {
        return tournamentFormats[this.format]?.playersPerSide === value;
      },
      message: "Players on field must match the selected tournament format."
    }
  },
  squadSize: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "Squad size must be a positive whole number."
    }
  },
  fantasyBudget: {
    type: Number,
    required() { return this.isNew; },
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "Fantasy budget must be a positive whole number of rupees."
    }
  },
  fantasySquadSize: {
    type: Number,
    required() { return this.isNew; },
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "Fantasy squad size must be a positive whole number."
    }
  },
  startingPlayers: {
    type: Number,
    required() { return this.isNew; },
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "Starting players must be a positive whole number."
    }
  },
  substitutes: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isSafeInteger,
      message: "Substitute count must be a non-negative whole number."
    }
  },
  budgetConfig: { type: budgetConfigSchema, required: true },
  status: { type: String, required: true, enum: ["DRAFT", "ACTIVE", "COMPLETED"], default: "DRAFT" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

tournamentSchema.pre("validate", function derivePlayersOnField() {
  const selectedFormat = tournamentFormats[this.format];
  if (selectedFormat) {
    this.playersOnField = selectedFormat.playersPerSide;
    this.footballFormat = { name: this.format, playersPerSide: selectedFormat.playersPerSide };
  }
});

tournamentSchema.pre("validate", function validateSquadConfiguration() {
  const playersOnField = tournamentFormats[this.format]?.playersPerSide;
  if (this.fantasySquadSize !== undefined || this.startingPlayers !== undefined || this.fantasyBudget !== undefined) {
    if (Number.isInteger(this.startingPlayers) && this.startingPlayers > playersOnField) {
      this.invalidate("startingPlayers", "Starting players cannot exceed the number of players on the field.");
    }
    if (Number.isInteger(this.startingPlayers) && Number.isInteger(this.substitutes)
      && Number.isInteger(this.fantasySquadSize)
      && this.startingPlayers + this.substitutes !== this.fantasySquadSize) {
      this.invalidate("fantasySquadSize", "Starting players and substitutes must add up to the fantasy squad size.");
    }
    if (Number.isInteger(this.startingPlayers) && Number.isInteger(this.fantasySquadSize)
      && this.startingPlayers > this.fantasySquadSize) {
      this.invalidate("startingPlayers", "Starting players cannot exceed the fantasy squad size.");
    }
  }
});

export default mongoose.model("Tournament", tournamentSchema);
