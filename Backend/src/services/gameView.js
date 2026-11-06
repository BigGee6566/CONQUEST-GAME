import { GAME_STATUS } from '../config/gameRules.js';

const idOf = (value) => (value?._id ? String(value._id) : value ? String(value) : null);

function playerViews(doc) {
  return doc.players.map((p) => {
    const held = doc.countries.filter((c) => String(c.owner) === String(p._id));
    return {
      id: String(p._id),
      name: p.name,
      isNPC: p.isNPC,
      npcProfile: p.npcProfile ?? null,
      color: p.color,
      homeCountry: p.homeCountry,
      isEliminated: p.isEliminated,
      eliminatedInRound: p.eliminatedInRound ?? null,
      stats: {
        attacksLaunched: p.stats?.attacksLaunched ?? 0,
        conquests: p.stats?.conquests ?? 0,
        soldiersLost: p.stats?.soldiersLost ?? 0,
        soldiersKilled: p.stats?.soldiersKilled ?? 0,
      },
      countryCount: held.length,
      soldierCount: held.reduce((sum, c) => sum + c.soldiers, 0),
    };
  });
}

function viewerFlags(doc, viewer, currentPlayer) {
  const isOwner = Boolean(viewer) && idOf(doc.owner) === String(viewer._id);
  const active = doc.status === GAME_STATUS.ACTIVE;
  return {
    isOwner,
    isSpectator: !isOwner,
    canAct: isOwner && active && !currentPlayer?.isNPC,
    canAdvanceNpc: isOwner && active && Boolean(currentPlayer?.isNPC),
  };
}

// Full board state for the game screen. Safe for spectators: contains no private data.
export function toGameView(doc, viewer) {
  const players = playerViews(doc);
  const currentPlayerId = String(doc.turnOrder[doc.currentTurnIndex]);
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  return {
    id: String(doc._id),
    title: doc.title,
    status: doc.status,
    visibility: doc.visibility,
    round: doc.round,
    turnNumber: doc.turnNumber,
    phase: doc.phase,
    pendingReinforcements: doc.pendingReinforcements,
    hasAttackedThisTurn: doc.hasAttackedThisTurn,
    activeAttack: doc.activeAttack
      ? { from: doc.activeAttack.from, to: doc.activeAttack.to, battleId: String(doc.activeAttack.battle) }
      : null,
    currentPlayerId,
    turnOrder: doc.turnOrder.map(String),
    players,
    countries: doc.countries.map((c) => ({
      code: c.code,
      name: c.name,
      region: c.region,
      population: c.population,
      soldierValue: c.soldierValue,
      soldiers: c.soldiers,
      ownerId: String(c.owner),
    })),
    winnerId: doc.winner ? String(doc.winner) : null,
    endReason: doc.endReason ?? null,
    eventSeq: doc.eventSeq,
    battleCount: doc.battleCount,
    owner: { id: idOf(doc.owner), username: doc.owner?.username ?? null },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
    viewer: viewerFlags(doc, viewer, currentPlayer),
  };
}

// Compact card for game lists.
export function toGameSummary(doc) {
  const players = playerViews(doc);
  const human = players.find((p) => !p.isNPC);
  const current = players.find((p) => p.id === String(doc.turnOrder[doc.currentTurnIndex]));
  const winner = players.find((p) => p.id === String(doc.winner));
  return {
    id: String(doc._id),
    title: doc.title,
    status: doc.status,
    visibility: doc.visibility,
    round: doc.round,
    owner: { id: idOf(doc.owner), username: doc.owner?.username ?? null },
    human: human && {
      name: human.name,
      homeCountry: human.homeCountry,
      countryCount: human.countryCount,
      soldierCount: human.soldierCount,
      isEliminated: human.isEliminated,
    },
    currentPlayerName: current?.name ?? null,
    winnerName: winner?.name ?? null,
    endReason: doc.endReason ?? null,
    playersRemaining: players.filter((p) => !p.isEliminated).length,
    battleCount: doc.battleCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toEventView(event) {
  return {
    seq: event.seq,
    round: event.round,
    type: event.type,
    actorId: event.actor ? String(event.actor) : null,
    actorName: event.actorName,
    message: event.message,
    reasoning: event.reasoning,
    battleId: event.battle ? String(event.battle) : null,
    data: event.data ?? {},
    createdAt: event.createdAt,
  };
}

export function toBattleView(battleDoc) {
  // Plain object first: spreading Mongoose subdocuments would copy their internal state.
  const battle = typeof battleDoc.toObject === 'function' ? battleDoc.toObject() : battleDoc;
  return {
    id: String(battle._id),
    gameId: String(battle.game),
    round: battle.round,
    turnNumber: battle.turnNumber,
    attacker: { ...battle.attacker, player: String(battle.attacker.player) },
    defender: { ...battle.defender, player: String(battle.defender.player) },
    exchanges: battle.exchanges.map((e) => ({
      attackerDice: [...e.attackerDice],
      defenderDice: [...e.defenderDice],
      attackerLosses: e.attackerLosses,
      defenderLosses: e.defenderLosses,
      attackerRemaining: e.attackerRemaining,
      defenderRemaining: e.defenderRemaining,
      commentary: e.commentary?.text ? { text: e.commentary.text, source: e.commentary.source } : null,
      rolledAt: e.rolledAt,
    })),
    outcome: battle.outcome,
    soldiersGained: battle.soldiersGained,
    summary: battle.summary,
    summarySource: battle.summarySource ?? null,
    createdAt: battle.createdAt,
    endedAt: battle.endedAt,
  };
}
