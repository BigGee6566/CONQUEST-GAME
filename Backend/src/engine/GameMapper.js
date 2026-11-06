import { Game } from './Game.js';

// Translates between the Mongoose Game document (ObjectIds, subdocuments) and the pure domain Game.
// Keeps the engine free of database code and the models free of game rules.
export const GameMapper = Object.freeze({
  toDomain(doc, options) {
    return new Game(
      {
        players: doc.players.map((p) => ({
          id: String(p._id),
          name: p.name,
          isNPC: p.isNPC,
          userId: p.user ? String(p.user) : null,
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
        })),
        countries: doc.countries.map((c) => ({
          code: c.code,
          name: c.name,
          region: c.region,
          population: c.population,
          soldierValue: c.soldierValue,
          soldiers: c.soldiers,
          ownerId: String(c.owner),
        })),
        turnOrder: doc.turnOrder.map(String),
        currentTurnIndex: doc.currentTurnIndex,
        round: doc.round,
        turnNumber: doc.turnNumber,
        phase: doc.phase,
        status: doc.status,
        pendingReinforcements: doc.pendingReinforcements,
        hasAttackedThisTurn: doc.hasAttackedThisTurn,
        activeAttack: doc.activeAttack
          ? { from: doc.activeAttack.from, to: doc.activeAttack.to, battleId: String(doc.activeAttack.battle) }
          : null,
        winnerId: doc.winner ? String(doc.winner) : null,
        endReason: doc.endReason ?? null,
      },
      options,
    );
  },

  // Plain field values to doc.set(); Mongoose casts the hex id strings back to ObjectIds.
  toPersistence(game) {
    const state = game.toState();
    return {
      players: state.players.map(({ id, userId, ...player }) => ({ _id: id, user: userId, ...player })),
      countries: state.countries.map(({ ownerId, ...country }) => ({ ...country, owner: ownerId })),
      turnOrder: state.turnOrder,
      currentTurnIndex: state.currentTurnIndex,
      round: state.round,
      turnNumber: state.turnNumber,
      phase: state.phase,
      status: state.status,
      pendingReinforcements: state.pendingReinforcements,
      hasAttackedThisTurn: state.hasAttackedThisTurn,
      activeAttack: state.activeAttack
        ? { from: state.activeAttack.from, to: state.activeAttack.to, battle: state.activeAttack.battleId }
        : null,
      winner: state.winnerId,
      endReason: state.endReason,
    };
  },
});
