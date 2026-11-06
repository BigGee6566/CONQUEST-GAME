import mongoose from 'mongoose';
import { BATTLE_OUTCOMES, GAME_RULES } from '../config/gameRules.js';

const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

const die = { type: Number, min: 1, max: GAME_RULES.DIE_FACES };

const combatantSchema = new Schema(
  {
    player: { type: ObjectId, required: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    countryName: { type: String, required: true },
    startingSoldiers: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// One simultaneous roll of paired dice within an attack.
const exchangeSchema = new Schema(
  {
    attackerDice: { type: [die], required: true },
    defenderDice: {
      type: [die],
      required: true,
      validate: {
        validator(dice) { return dice.length === this.attackerDice.length; },
        message: 'Each attacking die must be paired with exactly one defending die',
      },
    },
    attackerLosses: { type: Number, required: true, min: 0 },
    defenderLosses: { type: Number, required: true, min: 0 },
    attackerRemaining: { type: Number, required: true, min: 0 },
    defenderRemaining: { type: Number, required: true, min: 0 },
    commentary: {
      text: { type: String, maxlength: 600 },
      source: { type: String, enum: ['llm', 'fallback'] },
    },
    rolledAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Battles live in their own collection (referenced by game) because a long game produces an
// unbounded number of dice exchanges; embedding them would push the Game document toward
// MongoDB's 16 MB limit and make every turn save rewrite the full history.
const battleSchema = new Schema(
  {
    game: { type: ObjectId, ref: 'Game', required: true },
    round: { type: Number, required: true, min: 1 },
    turnNumber: { type: Number, required: true, min: 1 },
    attacker: { type: combatantSchema, required: true },
    defender: { type: combatantSchema, required: true },
    exchanges: { type: [exchangeSchema], default: [] },
    outcome: { type: String, enum: Object.values(BATTLE_OUTCOMES), default: BATTLE_OUTCOMES.IN_PROGRESS },
    soldiersGained: { type: Number, default: 0, min: 0 },
    summary: { type: String, maxlength: 1000, default: null },
    summarySource: { type: String, enum: ['llm', 'fallback', null], default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

battleSchema.index({ game: 1, createdAt: 1 });
battleSchema.index({ 'attacker.player': 1 });

export const Battle = model('Battle', battleSchema);
