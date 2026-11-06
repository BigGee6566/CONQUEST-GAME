import mongoose from 'mongoose';
import { BATTLE_OUTCOMES, GAME_STATUS, TURN_PHASES } from '../config/gameRules.js';
import { withTransaction } from '../database/transaction.js';
import {
  Dice,
  END_REASONS,
  GameFactory,
  GameMapper,
  NpcController,
  secureRandom,
} from '../engine/index.js';
import { Battle, Game as GameModel, GameEvent, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginate } from '../utils/query.js';
import { narrateExchange, narrateRetreat } from './commentary.service.js';
import { loadCatalog } from './country.service.js';
import { toBattleView, toEventView, toGameSummary, toGameView } from './gameView.js';

const BATTLE_EVENT_TYPES = new Set([
  'attack_started',
  'dice_rolled',
  'country_conquered',
  'attack_repelled',
  'attack_stopped',
]);

const newId = () => new mongoose.Types.ObjectId().toString();
const toDomain = (doc) => GameMapper.toDomain(doc, { dice: new Dice(secureRandom) });

// ---- Access control ----

async function findGame(gameId) {
  const doc = await GameModel.findById(gameId).populate('owner', 'username');
  if (!doc) throw ApiError.notFound('Game not found');
  return doc;
}

function isOwner(doc, user) {
  return Boolean(user) && String(doc.owner?._id ?? doc.owner) === String(user._id);
}

// Public games can be watched by anyone with the link; private ones only by their owner.
function assertCanView(doc, user) {
  if (doc.visibility === 'private' && !isOwner(doc, user)) throw ApiError.notFound('Game not found');
}

// Only the logged-in owner may play turns; everyone else is a spectator.
function assertCanPlay(doc, user) {
  if (!isOwner(doc, user)) {
    throw ApiError.forbidden('Only the commander who started this game can play it. You can still watch.');
  }
  if (doc.status !== GAME_STATUS.ACTIVE) throw ApiError.conflict('This game is over');
}

// ---- Persistence pipeline ----

// Builds the Battle document change and the AI commentary for this action. Runs before the
// transaction because the LLM call can take a moment and must not hold database locks.
async function prepareBattle(doc, game, battle, narrationMode) {
  if (!battle) return { battleDoc: null, commentary: null };

  const battleDoc = battle.started
    ? new Battle({ _id: battle.battleId, game: doc._id, ...battle.started })
    : await Battle.findOne({ _id: battle.battleId, game: doc._id });
  if (!battleDoc) throw ApiError.notFound('Battle record is missing');

  let commentary = null;
  if (battle.exchange) {
    const { pairs: _pairs, ...exchange } = battle.exchange;
    commentary = await narrateExchange(
      {
        battle: battleDoc,
        exchange,
        exchangeNumber: battleDoc.exchanges.length + 1,
        outcome: battle.outcome,
        soldiersGained: battle.soldiersGained,
      },
      { mode: narrationMode },
    );
    battleDoc.exchanges.push({ ...exchange, commentary });
  } else if (battle.outcome === BATTLE_OUTCOMES.STOPPED) {
    commentary = await narrateRetreat({
      battle: battleDoc,
      attackerRemaining: game.country(battleDoc.attacker.country).soldiers,
      defenderRemaining: game.country(battleDoc.defender.country).soldiers,
    });
  }

  if (battle.outcome) {
    battleDoc.outcome = battle.outcome;
    battleDoc.soldiersGained = battle.soldiersGained ?? 0;
    battleDoc.summary = commentary?.text ?? null;
    battleDoc.summarySource = commentary?.source ?? null;
    battleDoc.endedAt = new Date();
  }
  return { battleDoc, commentary };
}

function buildEventDocs(doc, events, battleId, commentary) {
  return events.map((event) => {
    doc.eventSeq += 1;
    const narrated = commentary && (event.type === 'dice_rolled' || event.type === 'attack_stopped');
    return {
      game: doc._id,
      seq: doc.eventSeq,
      round: event.round,
      type: event.type,
      actor: event.actorId,
      actorName: event.actorName,
      message: event.message,
      reasoning: event.reasoning,
      battle: battleId && BATTLE_EVENT_TYPES.has(event.type) ? battleId : null,
      data: narrated ? { ...event.data, commentary } : event.data,
    };
  });
}

function userStatChanges(game, battle, battleDoc, wasOver) {
  const human = game.humanPlayer;
  const inc = {};
  if (battle?.outcome && String(battleDoc.attacker.player) === human.id) {
    inc['stats.battlesFought'] = 1;
    if (battle.outcome === BATTLE_OUTCOMES.CONQUERED) {
      inc['stats.battlesWon'] = 1;
      inc['stats.countriesConquered'] = 1;
    }
  }
  if (game.isOver && !wasOver) inc[game.winnerId === human.id ? 'stats.gamesWon' : 'stats.gamesLost'] = 1;
  return inc;
}

// Writes the new game state, the battle and the events atomically. Game saves use optimistic
// concurrency, so two racing requests cannot both apply a move to the same turn.
async function commit(doc, game, result, { narrationMode = 'full' } = {}) {
  const wasOver = doc.status !== GAME_STATUS.ACTIVE;
  const { battleDoc, commentary } = await prepareBattle(doc, game, result.battle, narrationMode);

  doc.set(GameMapper.toPersistence(game));
  if (result.battle?.started) doc.battleCount += 1;
  if (game.isOver && !doc.completedAt) doc.completedAt = new Date();

  const eventDocs = buildEventDocs(doc, result.events, result.battle?.battleId ?? null, commentary);
  const statChanges = userStatChanges(game, result.battle, battleDoc, wasOver);

  let inserted = [];
  await withTransaction(async (session) => {
    await doc.save({ session });
    if (battleDoc) await battleDoc.save({ session });
    inserted = await GameEvent.insertMany(eventDocs, { session });
    if (Object.keys(statChanges).length > 0) {
      await User.updateOne({ _id: doc.owner._id ?? doc.owner }, { $inc: statChanges }, { session });
    }
  });
  return { inserted, battleDoc };
}

function respond(doc, user, { inserted, battleDoc }, extra = {}) {
  return {
    game: toGameView(doc, user),
    events: inserted.map(toEventView),
    battle: battleDoc ? toBattleView(battleDoc) : null,
    ...extra,
  };
}

// ---- Commands ----

export async function createGame(user, { homeCountry, title, visibility }) {
  const catalog = await loadCatalog();
  const { game, result } = GameFactory.create({
    owner: { userId: String(user._id), name: user.username },
    homeCountryCode: homeCountry,
    catalog,
    rng: secureRandom,
    generateId: newId,
    dice: new Dice(secureRandom),
  });

  const doc = new GameModel({
    owner: user._id,
    title: title ?? `${user.username}'s campaign from ${game.country(homeCountry).name}`,
    visibility,
    ...GameMapper.toPersistence(game),
  });
  const eventDocs = buildEventDocs(doc, result.events, null, null);

  let inserted = [];
  await withTransaction(async (session) => {
    await doc.save({ session });
    inserted = await GameEvent.insertMany(eventDocs, { session });
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.gamesPlayed': 1 } }, { session });
  });

  doc.owner = user;
  return { game: toGameView(doc, user), events: inserted.map(toEventView) };
}

export async function performAction(gameId, user, action) {
  const doc = await findGame(gameId);
  assertCanPlay(doc, user);
  const game = toDomain(doc);
  const battleId = action.type === 'attack' ? newId() : undefined;
  const result = game.perform(game.humanPlayer.id, { ...action, battleId });
  return respond(doc, user, await commit(doc, game, result));
}

// Plays exactly one NPC move. The client calls this in a loop (faster during fast-forward),
// so every NPC decision, roll and justification is shown as it happens.
export async function advanceNpc(gameId, user, { fastForward }) {
  const doc = await findGame(gameId);
  assertCanPlay(doc, user);
  const game = toDomain(doc);
  if (!game.currentPlayer.isNPC) throw ApiError.conflict('It is your turn - the NPCs are waiting for you');

  const { decision, result } = NpcController.takeTurnStep(game, { createBattleId: newId });
  const saved = await commit(doc, game, result, { narrationMode: fastForward ? 'outcomes' : 'full' });
  return respond(doc, user, saved, { decision: { type: decision.type, reasoning: decision.reasoning } });
}

export async function abandonGame(gameId, user) {
  const doc = await findGame(gameId);
  assertCanPlay(doc, user);
  const human = doc.players.find((p) => !p.isNPC);

  const battleDoc = doc.activeAttack
    ? await Battle.findOne({ _id: doc.activeAttack.battle, game: doc._id })
    : null;
  if (battleDoc) {
    battleDoc.set({ outcome: BATTLE_OUTCOMES.STOPPED, endedAt: new Date(), summary: 'The campaign was abandoned mid-battle.' });
  }

  doc.set({
    status: GAME_STATUS.ABANDONED,
    phase: TURN_PHASES.GAME_OVER,
    endReason: END_REASONS.ABANDONED,
    activeAttack: null,
    completedAt: new Date(),
  });
  doc.eventSeq += 1;
  const event = {
    game: doc._id,
    seq: doc.eventSeq,
    round: doc.round,
    type: 'game_over',
    actor: human._id,
    actorName: human.name,
    message: `${human.name} abandoned the campaign`,
    data: { reason: END_REASONS.ABANDONED },
  };

  let inserted = [];
  await withTransaction(async (session) => {
    await doc.save({ session });
    if (battleDoc) await battleDoc.save({ session });
    inserted = await GameEvent.insertMany([event], { session });
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.gamesLost': 1 } }, { session });
  });
  return respond(doc, user, { inserted, battleDoc: null });
}

// ---- Queries ----

export async function getGame(gameId, user) {
  const doc = await findGame(gameId);
  assertCanView(doc, user);
  return { game: toGameView(doc, user) };
}

export async function listGames({ scope, status, search, page, limit }, user) {
  const filter = {};
  if (scope === 'mine') {
    if (!user) throw ApiError.unauthorized('Log in to see your games');
    filter.owner = user._id;
  } else {
    filter.visibility = 'public';
  }
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const owners = await User.find({ username: pattern }).select('_id').limit(50).lean();
    filter.$or = [{ title: pattern }, { owner: { $in: owners.map((o) => o._id) } }];
  }

  const result = await paginate(
    GameModel.find(filter).sort({ updatedAt: -1 }).populate('owner', 'username'),
    GameModel.countDocuments(filter),
    { page, limit },
  );
  return { ...result, items: result.items.map(toGameSummary) };
}

async function findViewableMeta(gameId, user) {
  const doc = await GameModel.findById(gameId).select('owner visibility eventSeq');
  if (!doc) throw ApiError.notFound('Game not found');
  assertCanView(doc, user);
  return doc;
}

// Spectators and the game screen poll this with ?after=<last seq seen> for live updates.
export async function listEvents(gameId, user, { after, tail, limit }) {
  const doc = await findViewableMeta(gameId, user);
  const events = tail
    ? (await GameEvent.find({ game: doc._id }).sort({ seq: -1 }).limit(tail)).reverse()
    : await GameEvent.find({ game: doc._id, seq: { $gt: after } }).sort({ seq: 1 }).limit(limit);
  return { items: events.map(toEventView), latestSeq: doc.eventSeq };
}

export async function listBattles(gameId, user, { page, limit }) {
  const doc = await findViewableMeta(gameId, user);
  const filter = { game: doc._id };
  const result = await paginate(
    Battle.find(filter).sort({ createdAt: -1 }),
    Battle.countDocuments(filter),
    { page, limit },
  );
  return {
    ...result,
    items: result.items.map((b) => ({
      id: String(b._id),
      round: b.round,
      attacker: { name: b.attacker.name, country: b.attacker.country, countryName: b.attacker.countryName },
      defender: { name: b.defender.name, country: b.defender.country, countryName: b.defender.countryName },
      outcome: b.outcome,
      exchangeCount: b.exchanges.length,
      soldiersGained: b.soldiersGained,
      createdAt: b.createdAt,
    })),
  };
}

export async function getBattle(gameId, battleId, user) {
  const doc = await findViewableMeta(gameId, user);
  const battle = await Battle.findOne({ _id: battleId, game: doc._id });
  if (!battle) throw ApiError.notFound('Battle not found');
  return { battle: toBattleView(battle) };
}
