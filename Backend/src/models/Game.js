import mongoose from 'mongoose';
import {
  GAME_RULES,
  GAME_STATUS,
  MAX_SOLDIER_VALUE,
  NPC_PROFILES,
  REGIONS,
  TURN_PHASES,
} from '../config/gameRules.js';

const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

// Players and countries are embedded: they are always read and written together with the game,
// are bounded at 10 each, and must change atomically when a turn resolves.
const playerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  isNPC: { type: Boolean, required: true },
  user: {
    type: ObjectId,
    ref: 'User',
    default: null,
    required: [function requiresUser() { return !this.isNPC; }, 'A human player must be linked to a user'],
  },
  npcProfile: {
    type: String,
    enum: Object.values(NPC_PROFILES),
    default: null,
    required: [function requiresProfile() { return this.isNPC; }, 'An NPC needs a behaviour profile'],
  },
  color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
  homeCountry: { type: String, required: true, uppercase: true, match: /^[A-Z]{2}$/ },
  isEliminated: { type: Boolean, default: false },
  eliminatedInRound: { type: Number, default: null, min: 1 },
  stats: {
    attacksLaunched: { type: Number, default: 0, min: 0 },
    conquests: { type: Number, default: 0, min: 0 },
    soldiersLost: { type: Number, default: 0, min: 0 },
    soldiersKilled: { type: Number, default: 0, min: 0 },
  },
});

const countrySchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, match: /^[A-Z]{2}$/ },
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, enum: REGIONS },
    population: { type: Number, required: true, min: 1 },
    // Base value from the population table; used for the conquest reward.
    soldierValue: { type: Number, required: true, min: 1, max: MAX_SOLDIER_VALUE },
    soldiers: { type: Number, required: true, min: 0 },
    // _id of the owning entry in players[] (subdocument reference within this game).
    owner: { type: ObjectId, required: true },
  },
  { _id: false },
);

const activeAttackSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    battle: { type: ObjectId, ref: 'Battle', required: true },
  },
  { _id: false },
);

const gameSchema = new Schema(
  {
    owner: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, maxlength: 80 },
    status: { type: String, enum: Object.values(GAME_STATUS), default: GAME_STATUS.ACTIVE },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    round: { type: Number, default: 1, min: 1 },
    turnNumber: { type: Number, default: 1, min: 1 },
    turnOrder: { type: [ObjectId], required: true },
    currentTurnIndex: { type: Number, default: 0, min: 0 },
    phase: { type: String, enum: Object.values(TURN_PHASES), default: TURN_PHASES.ACTION },
    pendingReinforcements: { type: Number, default: 0, min: 0 },
    hasAttackedThisTurn: { type: Boolean, default: false },
    activeAttack: { type: activeAttackSchema, default: null },
    players: { type: [playerSchema], required: true },
    countries: { type: [countrySchema], required: true },
    winner: { type: ObjectId, default: null },
    endReason: { type: String, enum: ['conquest', 'defeat', 'abandoned', null], default: null },
    battleCount: { type: Number, default: 0, min: 0 },
    // Monotonic counter for GameEvent.seq so spectators can poll "events after N".
    eventSeq: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    // Rejects a save if another request changed the game first (double-clicks, two tabs).
    optimisticConcurrency: true,
    toJSON: { virtuals: true },
  },
);

gameSchema.index({ owner: 1, status: 1, updatedAt: -1 });
gameSchema.index({ status: 1, visibility: 1, updatedAt: -1 });

gameSchema.pre('validate', function enforceGameInvariants() {
  const { TOTAL_COUNTRIES } = GAME_RULES;

  if (this.players.length !== TOTAL_COUNTRIES) {
    this.invalidate('players', `A game must have exactly ${TOTAL_COUNTRIES} players`);
  }
  if (this.players.filter((p) => !p.isNPC).length !== 1) {
    this.invalidate('players', 'A game must have exactly one human player');
  }
  if (this.countries.length !== TOTAL_COUNTRIES) {
    this.invalidate('countries', `A game must have exactly ${TOTAL_COUNTRIES} countries`);
  }
  if (new Set(this.countries.map((c) => c.code)).size !== this.countries.length) {
    this.invalidate('countries', 'Countries in a game must be unique');
  }

  const playerIds = new Set(this.players.map((p) => String(p._id)));
  if (this.countries.some((c) => !playerIds.has(String(c.owner)))) {
    this.invalidate('countries', 'Every country must be owned by a player in this game');
  }
  if (this.turnOrder.some((id) => !playerIds.has(String(id)))) {
    this.invalidate('turnOrder', 'Turn order may only reference players in this game');
  }
  if (this.currentTurnIndex >= Math.max(this.turnOrder.length, 1)) {
    this.invalidate('currentTurnIndex', 'Current turn index is out of range');
  }
});

gameSchema.virtual('currentPlayerId').get(function currentPlayerId() {
  return this.turnOrder?.[this.currentTurnIndex] ?? null;
});

gameSchema.virtual('humanPlayer').get(function humanPlayer() {
  return this.players?.find((p) => !p.isNPC) ?? null;
});

gameSchema.methods.findPlayer = function findPlayer(playerId) {
  return this.players.id(playerId);
};

gameSchema.methods.findCountry = function findCountry(code) {
  return this.countries.find((c) => c.code === code) ?? null;
};

gameSchema.methods.countriesOwnedBy = function countriesOwnedBy(playerId) {
  return this.countries.filter((c) => String(c.owner) === String(playerId));
};

gameSchema.methods.isOwnedByUser = function isOwnedByUser(userId) {
  return Boolean(userId) && String(this.owner) === String(userId);
};

export const Game = model('Game', gameSchema);
