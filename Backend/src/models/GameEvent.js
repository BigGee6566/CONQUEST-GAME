import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

export const EVENT_TYPES = Object.freeze([
  'game_created',
  'turn_started',
  'reinforcements_received',
  'reinforcements_placed',
  'transfer',
  'attack_started',
  'dice_rolled',
  'country_conquered',
  'attack_repelled',
  'attack_stopped',
  'turn_skipped',
  'turn_ended',
  'npc_decision',
  'player_eliminated',
  'game_won',
  'game_over',
]);

// Append-only activity feed for a game. It drives the live log, keeps every NPC decision and its
// justification visible (including during fast-forward), and lets spectators poll by seq.
const gameEventSchema = new Schema(
  {
    game: { type: ObjectId, ref: 'Game', required: true },
    seq: { type: Number, required: true, min: 1 },
    round: { type: Number, required: true, min: 1 },
    type: { type: String, required: true, enum: EVENT_TYPES },
    actor: { type: ObjectId, default: null },
    actorName: { type: String, default: null },
    message: { type: String, required: true, maxlength: 500 },
    reasoning: { type: String, maxlength: 1000, default: null },
    battle: { type: ObjectId, ref: 'Battle', default: null },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

gameEventSchema.index({ game: 1, seq: 1 }, { unique: true });

export const GameEvent = model('GameEvent', gameEventSchema);
