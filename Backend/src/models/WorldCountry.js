import mongoose from 'mongoose';
import { MAX_SOLDIER_VALUE, REGIONS, soldierValueForPopulation } from '../config/gameRules.js';

const { Schema, model } = mongoose;

// Reference catalogue of real-world countries a game can be set up from.
// Each new game copies 10 of these into its own embedded country list.
const worldCountrySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2}$/, 'Country code must be an ISO 3166-1 alpha-2 code'],
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    region: { type: String, required: true, enum: REGIONS },
    population: { type: Number, required: true, min: 1 },
    soldierValue: { type: Number, min: 1, max: MAX_SOLDIER_VALUE },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
  },
);

worldCountrySchema.index({ code: 1 }, { unique: true });
worldCountrySchema.index({ name: 1 }, { unique: true });
worldCountrySchema.index({ region: 1, soldierValue: -1 });

worldCountrySchema.virtual('flag').get(function flag() {
  // Regional-indicator letters render as the country's flag emoji.
  return [...this.code].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join('');
});

worldCountrySchema.pre('validate', function deriveSoldierValue() {
  if (Number.isFinite(this.population)) {
    this.soldierValue = soldierValueForPopulation(this.population);
  }
});

export const WorldCountry = model('WorldCountry', worldCountrySchema);
