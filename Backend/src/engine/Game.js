import { BATTLE_OUTCOMES, GAME_RULES, GAME_STATUS, TURN_PHASES } from '../config/gameRules.js';
import { ActionResult } from './ActionResult.js';
import { BattleEngine } from './BattleEngine.js';
import { Country } from './Country.js';
import { Dice } from './Dice.js';
import { assertPositiveInteger, GameRuleError } from './errors.js';
import { Player } from './Player.js';

export const END_REASONS = Object.freeze({
  CONQUEST: 'conquest',
  DEFEAT: 'defeat',
  ABANDONED: 'abandoned',
});

const PHASE_HINTS = {
  [TURN_PHASES.REINFORCE]: 'Place your reinforcements first',
  [TURN_PHASES.ACTION]: 'There is no attack in progress',
  [TURN_PHASES.ATTACKING]: 'Finish or stop the current attack first',
  [TURN_PHASES.GAME_OVER]: 'The game is over',
};

function combatant(player, country) {
  return {
    player: player.id,
    name: player.name,
    country: country.code,
    countryName: country.name,
    startingSoldiers: country.soldiers,
  };
}

// The game aggregate: owns all players and countries and is the only place rules are enforced.
// Every command validates first, then mutates, and returns an ActionResult describing what happened.
export class Game {
  #players;
  #countries;
  #turnOrder;
  #currentTurnIndex;
  #round;
  #turnNumber;
  #phase;
  #status;
  #pendingReinforcements;
  #hasAttackedThisTurn;
  #activeAttack;
  #winnerId;
  #endReason;
  #battleEngine;

  constructor(state, { dice = new Dice() } = {}) {
    this.#players = new Map(state.players.map((p) => {
      const player = p instanceof Player ? p : new Player(p);
      return [player.id, player];
    }));
    this.#countries = new Map(state.countries.map((c) => {
      const country = c instanceof Country ? c : new Country(c);
      return [country.code, country];
    }));
    this.#turnOrder = state.turnOrder.map(String);
    this.#currentTurnIndex = state.currentTurnIndex ?? 0;
    this.#round = state.round ?? 1;
    this.#turnNumber = state.turnNumber ?? 1;
    this.#phase = state.phase ?? TURN_PHASES.ACTION;
    this.#status = state.status ?? GAME_STATUS.ACTIVE;
    this.#pendingReinforcements = state.pendingReinforcements ?? 0;
    this.#hasAttackedThisTurn = state.hasAttackedThisTurn ?? false;
    this.#activeAttack = state.activeAttack ? { ...state.activeAttack } : null;
    this.#winnerId = state.winnerId ?? null;
    this.#endReason = state.endReason ?? null;
    this.#battleEngine = new BattleEngine(dice);
  }

  // ---- Queries ----

  get round() { return this.#round; }
  get turnNumber() { return this.#turnNumber; }
  get phase() { return this.#phase; }
  get status() { return this.#status; }
  get pendingReinforcements() { return this.#pendingReinforcements; }
  get hasAttackedThisTurn() { return this.#hasAttackedThisTurn; }
  get winnerId() { return this.#winnerId; }
  get endReason() { return this.#endReason; }
  get isOver() { return this.#status !== GAME_STATUS.ACTIVE; }
  get turnOrder() { return [...this.#turnOrder]; }
  get currentTurnIndex() { return this.#currentTurnIndex; }
  get activeAttack() { return this.#activeAttack ? { ...this.#activeAttack } : null; }
  get players() { return [...this.#players.values()]; }
  get countries() { return [...this.#countries.values()]; }
  get currentPlayer() { return this.#players.get(this.#turnOrder[this.#currentTurnIndex]); }
  get humanPlayer() { return this.players.find((p) => !p.isNPC) ?? null; }

  player(id) {
    const player = this.#players.get(String(id));
    if (!player) throw new GameRuleError('UNKNOWN_PLAYER', `No player ${id} in this game`);
    return player;
  }

  country(code) {
    const country = this.#countries.get(String(code ?? '').toUpperCase());
    if (!country) throw new GameRuleError('UNKNOWN_COUNTRY', `No country "${code}" in this game`);
    return country;
  }

  countriesOf(playerId) {
    return this.countries.filter((c) => c.isOwnedBy(playerId));
  }

  soldiersOf(playerId) {
    return this.countriesOf(playerId).reduce((sum, c) => sum + c.soldiers, 0);
  }

  activePlayers() {
    return this.players.filter((p) => !p.isEliminated);
  }

  reinforcementsFor(playerId) {
    return GAME_RULES.REINFORCEMENTS_PER_COUNTRY * this.countriesOf(playerId).length;
  }

  createEvent(type, message, { actor = this.currentPlayer, data = {}, reasoning = null } = {}) {
    return {
      type,
      round: this.#round,
      turnNumber: this.#turnNumber,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      message,
      reasoning,
      data,
    };
  }

  // ---- Commands ----

  start() {
    const result = new ActionResult();
    const order = this.#turnOrder.map((id) => this.#players.get(id).name);
    result.add(this.createEvent(
      'game_created',
      `A new war begins between ${this.#players.size} nations. Turn order: ${order.join(', ')}`,
      { actor: null, data: { turnOrder: order } },
    ));
    this.#startTurn(result);
    return result;
  }

  perform(playerId, action) {
    switch (action?.type) {
      case 'reinforce': return this.placeReinforcements(playerId, action.allocation);
      case 'transfer': return this.transfer(playerId, action.from, action.to, action.soldiers);
      case 'attack': return this.beginAttack(playerId, action.from, action.to, action.battleId);
      case 'roll': return this.rollAttack(playerId);
      case 'stop': return this.stopAttack(playerId);
      case 'endTurn': return this.endTurn(playerId);
      default: throw new GameRuleError('UNKNOWN_ACTION', `Unknown action "${action?.type}"`);
    }
  }

  placeReinforcements(playerId, allocation) {
    const player = this.#assertTurn(playerId, TURN_PHASES.REINFORCE);
    if (!Array.isArray(allocation) || allocation.length === 0) {
      throw new GameRuleError('INVALID_ALLOCATION', 'Choose where to place your reinforcements');
    }

    const placements = allocation.map(({ country, soldiers }) => {
      assertPositiveInteger(soldiers, 'Reinforcements per country');
      return { target: this.#ownedCountry(player, country), soldiers };
    });
    const total = placements.reduce((sum, p) => sum + p.soldiers, 0);
    if (total > this.#pendingReinforcements) {
      throw new GameRuleError(
        'TOO_MANY_REINFORCEMENTS',
        `You only have ${this.#pendingReinforcements} soldiers to place, not ${total}`,
      );
    }

    placements.forEach(({ target, soldiers }) => target.reinforce(soldiers));
    this.#pendingReinforcements -= total;
    if (this.#pendingReinforcements === 0) this.#phase = TURN_PHASES.ACTION;

    const summary = placements.map((p) => `${p.target.name} +${p.soldiers}`).join(', ');
    return new ActionResult().add(this.createEvent(
      'reinforcements_placed',
      `${player.name} deployed ${total} soldier${total === 1 ? '' : 's'}: ${summary}`,
      {
        actor: player,
        data: {
          placements: placements.map((p) => ({ country: p.target.code, soldiers: p.soldiers })),
          remaining: this.#pendingReinforcements,
        },
      },
    ));
  }

  transfer(playerId, fromCode, toCode, soldiers) {
    const player = this.#assertTurn(playerId, TURN_PHASES.ACTION);
    const from = this.#ownedCountry(player, fromCode);
    const to = this.#ownedCountry(player, toCode);
    if (from === to) throw new GameRuleError('SAME_COUNTRY', 'Choose two different countries');
    assertPositiveInteger(soldiers, 'Soldiers to transfer');

    from.withdraw(soldiers);
    to.reinforce(soldiers);

    return new ActionResult().add(this.createEvent(
      'transfer',
      `${player.name} moved ${soldiers} soldier${soldiers === 1 ? '' : 's'} from ${from.name} to ${to.name}`,
      { actor: player, data: { from: from.code, to: to.code, soldiers } },
    ));
  }

  beginAttack(playerId, fromCode, toCode, battleId) {
    const player = this.#assertTurn(playerId, TURN_PHASES.ACTION);
    if (this.#hasAttackedThisTurn) {
      throw new GameRuleError('ALREADY_ATTACKED', 'You can only launch one attack per turn');
    }
    const from = this.#ownedCountry(player, fromCode);
    const to = this.country(toCode);
    if (to.isOwnedBy(player.id)) throw new GameRuleError('OWN_COUNTRY', `You already control ${to.name}`);
    if (!from.canAttack()) {
      throw new GameRuleError(
        'NOT_ENOUGH_SOLDIERS',
        `${from.name} needs at least ${GAME_RULES.MIN_SOLDIERS_TO_ATTACK} soldiers to attack`,
      );
    }
    if (!battleId) throw new TypeError('beginAttack requires a battleId');

    const defender = this.player(to.ownerId);
    this.#activeAttack = { from: from.code, to: to.code, battleId: String(battleId) };
    this.#hasAttackedThisTurn = true;
    this.#phase = TURN_PHASES.ATTACKING;
    player.recordAttack();

    return new ActionResult()
      .add(this.createEvent(
        'attack_started',
        `${player.name} attacks ${to.name} (${to.soldiers}) from ${from.name} (${from.soldiers})`,
        {
          actor: player,
          data: { from: from.code, to: to.code, attackerSoldiers: from.soldiers, defenderSoldiers: to.soldiers, defenderId: defender.id },
        },
      ))
      .setBattle({
        battleId: String(battleId),
        started: {
          round: this.#round,
          turnNumber: this.#turnNumber,
          attacker: combatant(player, from),
          defender: combatant(defender, to),
        },
      });
  }

  rollAttack(playerId) {
    const attacker = this.#assertTurn(playerId, TURN_PHASES.ATTACKING);
    const { from: fromCode, to: toCode, battleId } = this.#activeAttack;
    const from = this.country(fromCode);
    const to = this.country(toCode);
    const defender = this.player(to.ownerId);

    const exchange = this.#battleEngine.rollExchange(from, to);
    attacker.recordCasualties({ lost: exchange.attackerLosses, killed: exchange.defenderLosses });
    defender.recordCasualties({ lost: exchange.defenderLosses, killed: exchange.attackerLosses });

    const result = new ActionResult()
      .add(this.createEvent(
        'dice_rolled',
        `${from.name} rolls ${exchange.attackerDice.join('-')} vs ${to.name} ${exchange.defenderDice.join('-')}: `
          + `${from.name} loses ${exchange.attackerLosses}, ${to.name} loses ${exchange.defenderLosses}`,
        { actor: attacker, data: { from: from.code, to: to.code, ...exchange } },
      ))
      .setBattle({ battleId, exchange });

    if (to.soldiers === 0) {
      this.#resolveConquest(result, attacker, defender, from, to);
    } else if (!from.canAttack()) {
      this.#activeAttack = null;
      this.#phase = TURN_PHASES.ACTION;
      result
        .add(this.createEvent(
          'attack_repelled',
          `${to.name} holds! ${from.name} is down to ${from.soldiers} soldier and the attack collapses`,
          { actor: attacker, data: { from: from.code, to: to.code } },
        ))
        .setBattle({ outcome: BATTLE_OUTCOMES.REPELLED });
    }
    return result;
  }

  stopAttack(playerId) {
    const player = this.#assertTurn(playerId, TURN_PHASES.ATTACKING);
    const { from: fromCode, to: toCode, battleId } = this.#activeAttack;
    const from = this.country(fromCode);
    const to = this.country(toCode);
    this.#activeAttack = null;
    this.#phase = TURN_PHASES.ACTION;

    const result = new ActionResult()
      .add(this.createEvent(
        'attack_stopped',
        `${player.name} calls off the attack on ${to.name}, keeping ${from.soldiers} soldiers in ${from.name}`,
        { actor: player, data: { from: from.code, to: to.code } },
      ))
      .setBattle({ battleId, outcome: BATTLE_OUTCOMES.STOPPED });

    // The brief: stopping an attack ends the player's turn.
    return result.merge(this.endTurn(playerId));
  }

  endTurn(playerId) {
    const player = this.#assertTurn(playerId, TURN_PHASES.ACTION);
    const result = new ActionResult().add(this.createEvent(
      this.#hasAttackedThisTurn ? 'turn_ended' : 'turn_skipped',
      this.#hasAttackedThisTurn ? `${player.name} ends their turn` : `${player.name} skips their turn`,
      { actor: player },
    ));
    this.#advanceTurn(result);
    return result;
  }

  // ---- Snapshot ----

  toState() {
    return {
      players: this.players.map((p) => p.toJSON()),
      countries: this.countries.map((c) => c.toJSON()),
      turnOrder: this.turnOrder,
      currentTurnIndex: this.#currentTurnIndex,
      round: this.#round,
      turnNumber: this.#turnNumber,
      phase: this.#phase,
      status: this.#status,
      pendingReinforcements: this.#pendingReinforcements,
      hasAttackedThisTurn: this.#hasAttackedThisTurn,
      activeAttack: this.activeAttack,
      winnerId: this.#winnerId,
      endReason: this.#endReason,
    };
  }

  // ---- Internals ----

  #assertTurn(playerId, ...allowedPhases) {
    if (this.isOver) throw new GameRuleError('GAME_OVER', 'The game is over');
    const current = this.currentPlayer;
    if (current.id !== String(playerId)) {
      throw new GameRuleError('NOT_YOUR_TURN', `It is ${current.name}'s turn`);
    }
    if (!allowedPhases.includes(this.#phase)) {
      const hint = this.#phase === TURN_PHASES.REINFORCE
        ? `Place your ${this.#pendingReinforcements} reinforcements first`
        : PHASE_HINTS[this.#phase];
      throw new GameRuleError('WRONG_PHASE', hint);
    }
    return current;
  }

  #ownedCountry(player, code) {
    const country = this.country(code);
    if (!country.isOwnedBy(player.id)) {
      throw new GameRuleError('NOT_YOUR_COUNTRY', `${country.name} is not under your control`);
    }
    return country;
  }

  #resolveConquest(result, attacker, defender, from, to) {
    const reward = to.conquestReward;
    to.occupy(attacker.id, reward);
    attacker.recordConquest();
    this.#activeAttack = null;
    this.#phase = TURN_PHASES.ACTION;

    result
      .add(this.createEvent(
        'country_conquered',
        `${attacker.name} conquers ${to.name} and gains ${reward} soldiers`,
        { actor: attacker, data: { country: to.code, from: from.code, previousOwnerId: defender.id, soldiersGained: reward } },
      ))
      .setBattle({ outcome: BATTLE_OUTCOMES.CONQUERED, soldiersGained: reward });

    if (this.countriesOf(defender.id).length === 0) {
      defender.eliminate(this.#round);
      result.add(this.createEvent(
        'player_eliminated',
        `${defender.name} has been wiped off the map`,
        { actor: defender, data: { eliminatedBy: attacker.id } },
      ));
    }

    if (this.countriesOf(attacker.id).length === this.#countries.size) {
      this.#finish(result, attacker, END_REASONS.CONQUEST);
    } else if (!defender.isNPC && defender.isEliminated) {
      this.#finish(result, null, END_REASONS.DEFEAT);
    }
  }

  #finish(result, winner, reason) {
    this.#status = GAME_STATUS.COMPLETED;
    this.#phase = TURN_PHASES.GAME_OVER;
    this.#winnerId = winner?.id ?? null;
    this.#endReason = reason;
    const message = reason === END_REASONS.CONQUEST
      ? `${winner.name} has conquered the world!`
      : `${this.humanPlayer?.name ?? 'The player'} has been eliminated. The war is lost.`;
    result.add(this.createEvent(
      reason === END_REASONS.CONQUEST ? 'game_won' : 'game_over',
      message,
      { actor: winner, data: { reason } },
    ));
  }

  #advanceTurn(result) {
    const count = this.#turnOrder.length;
    let index = this.#currentTurnIndex;
    let wrapped = false;
    do {
      index = (index + 1) % count;
      if (index === 0) wrapped = true;
    } while (this.#players.get(this.#turnOrder[index]).isEliminated);

    // A round is complete once every remaining player has had a turn.
    if (wrapped) this.#round += 1;
    this.#currentTurnIndex = index;
    this.#turnNumber += 1;
    this.#hasAttackedThisTurn = false;
    this.#activeAttack = null;
    this.#pendingReinforcements = 0;
    this.#startTurn(result);
  }

  #startTurn(result) {
    const player = this.currentPlayer;
    result.add(this.createEvent('turn_started', `Round ${this.#round}: ${player.name}'s turn`, { actor: player }));

    if (this.#round < GAME_RULES.REINFORCEMENTS_START_ROUND) {
      this.#phase = TURN_PHASES.ACTION;
      return;
    }
    const held = this.countriesOf(player.id).length;
    this.#pendingReinforcements = this.reinforcementsFor(player.id);
    this.#phase = TURN_PHASES.REINFORCE;
    result.add(this.createEvent(
      'reinforcements_received',
      `${player.name} receives ${this.#pendingReinforcements} reinforcements (${held} countr${held === 1 ? 'y' : 'ies'} x ${GAME_RULES.REINFORCEMENTS_PER_COUNTRY})`,
      { actor: player, data: { amount: this.#pendingReinforcements, countries: held } },
    ));
  }
}
