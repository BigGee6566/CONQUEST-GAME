import { GAME_RULES } from '../../config/gameRules.js';
import { conquestOdds } from './conquestOdds.js';
import { PATIENCE_DECAY_PER_ROUND, tuningFor } from './profiles.js';

const pct = (chance) => `${Math.round(chance * 100)}%`;

// Evaluates the board from one NPC's point of view. Every plan comes with a plain-English
// justification that the game shows to the human player.
export class NpcStrategy {
  #game;
  #player;
  #tuning;
  #leaderId;

  constructor(game, player) {
    this.#game = game;
    this.#player = player;
    this.#tuning = tuningFor(player.npcProfile);
  }

  get tuning() {
    return this.#tuning;
  }

  planReinforcements() {
    const amount = this.#game.pendingReinforcements;
    const own = this.#ownCountries();
    const launchpad = this.#bestLaunchpad(amount);
    const massed = launchpad ? Math.round(amount * this.#tuning.offenseShare) : 0;

    const allocation = new Map();
    if (massed > 0) allocation.set(launchpad.from.code, massed);

    // The rest shores up the weakest garrisons, one soldier at a time.
    const strength = new Map(own.map((c) => [c.code, c.soldiers + (allocation.get(c.code) ?? 0)]));
    for (let left = amount - massed; left > 0; left -= 1) {
      const [weakest] = [...strength.entries()].sort((a, b) => a[1] - b[1])[0];
      strength.set(weakest, strength.get(weakest) + 1);
      allocation.set(weakest, (allocation.get(weakest) ?? 0) + 1);
    }

    const parts = [];
    if (massed > 0) {
      const after = conquestOdds(launchpad.from.soldiers + massed, launchpad.to.soldiers);
      parts.push(`massing ${massed} in ${launchpad.from.name} to threaten ${launchpad.to.name} (${pct(after.winChance)} odds once reinforced)`);
    }
    const defensive = [...allocation].filter(([code]) => !(massed > 0 && code === launchpad.from.code));
    if (defensive.length > 0) {
      parts.push(`shoring up ${defensive.map(([code, n]) => `${this.#game.country(code).name} +${n}`).join(', ')}`);
    }

    return {
      allocation: [...allocation].map(([country, soldiers]) => ({ country, soldiers })),
      reasoning: `${this.#label()} deployment: ${parts.join('; ') || 'holding steady'}.`,
    };
  }

  chooseAttack() {
    const required = this.#requiredWinChance();
    const viable = this.#rankAttacks().filter((option) => option.odds.winChance >= required);
    if (viable.length === 0) {
      return {
        attack: null,
        reasoning: `No target offers the ${pct(required)} odds a ${this.#tuning.label} commander needs, so ${this.#player.name} holds position.`,
      };
    }
    const best = viable[0];
    return { attack: { from: best.from.code, to: best.to.code }, reasoning: this.#describeAttack(best) };
  }

  shouldContinueAttack() {
    const { from, to } = this.#game.activeAttack;
    const attacker = this.#game.country(from);
    const defender = this.#game.country(to);
    const odds = conquestOdds(attacker.soldiers, defender.soldiers);
    const continueAttack = odds.winChance >= this.#tuning.retreatBelow;
    return {
      continueAttack,
      reasoning: continueAttack
        ? `Pressing on: ${attacker.soldiers} vs ${defender.soldiers} still gives ${pct(odds.winChance)} odds of taking ${defender.name}.`
        : `Calling it off: ${attacker.soldiers} vs ${defender.soldiers} leaves only ${pct(odds.winChance)} odds, below the ${pct(this.#tuning.retreatBelow)} a ${this.#tuning.label} commander accepts.`,
    };
  }

  // At most one repositioning move per turn, keeping NPC turns quick to watch.
  planTransfers() {
    const own = this.#ownCountries().sort((a, b) => b.soldiers - a.soldiers);
    if (own.length < 2) return [];
    const strongest = own[0];

    if (this.#tuning.consolidate) {
      const donor = own[1];
      const moving = donor.soldiers - GAME_RULES.MIN_SOLDIERS_LEFT_BEHIND;
      if (moving < 2) return [];
      return [{
        from: donor.code,
        to: strongest.code,
        soldiers: moving,
        reasoning: `Consolidating ${moving} soldiers from ${donor.name} into the main army in ${strongest.name} for the next strike.`,
      }];
    }

    const weakest = own[own.length - 1];
    const moving = Math.floor((strongest.soldiers - weakest.soldiers) * this.#tuning.rebalanceShare);
    if (moving < 1 || strongest.soldiers - weakest.soldiers < 3) return [];
    return [{
      from: strongest.code,
      to: weakest.code,
      soldiers: moving,
      reasoning: `Moving ${moving} soldiers from ${strongest.name} (${strongest.soldiers}) to the exposed garrison in ${weakest.name} (${weakest.soldiers}).`,
    }];
  }

  // ---- Internals ----

  #label() {
    const { label } = this.#tuning;
    return label[0].toUpperCase() + label.slice(1);
  }

  #ownCountries() {
    return this.#game.countriesOf(this.#player.id);
  }

  #enemyCountries() {
    return this.#game.countries.filter((c) => !c.isOwnedBy(this.#player.id));
  }

  #requiredWinChance() {
    const { minWinChance, patienceFloor } = this.#tuning;
    return Math.max(patienceFloor, minWinChance - (this.#game.round - 1) * PATIENCE_DECAY_PER_ROUND);
  }

  // The strongest rival: a natural target for a "stop the leader" bonus.
  #leader() {
    if (this.#leaderId === undefined) {
      const rivals = this.#game.activePlayers().filter((p) => p.id !== this.#player.id);
      rivals.sort((a, b) => this.#game.soldiersOf(b.id) - this.#game.soldiersOf(a.id));
      this.#leaderId = rivals[0]?.id ?? null;
    }
    return this.#leaderId;
  }

  #evaluate(from, to, attackerSoldiers) {
    const t = this.#tuning;
    const odds = conquestOdds(attackerSoldiers, to.soldiers);
    const owner = this.#game.player(to.ownerId);
    const eliminates = this.#game.countriesOf(owner.id).length === 1;
    const isLeader = this.#leader() === owner.id;
    const prize = GAME_RULES.REINFORCEMENTS_PER_COUNTRY
      + to.conquestReward
      + (eliminates ? t.eliminationBonus : 0)
      + (owner.isNPC ? 0 : t.humanBonus)
      + (isLeader ? t.leaderBonus : 0);
    const risk = odds.expectedAttackerLosses * t.lossAversion;
    return {
      from,
      to,
      owner,
      odds,
      eliminates,
      isLeader,
      score: odds.winChance * prize - (1 - odds.winChance) * risk,
    };
  }

  #rankAttacks(bonusCountry = null, bonus = 0) {
    const options = [];
    for (const from of this.#ownCountries()) {
      const strength = from.soldiers + (from === bonusCountry ? bonus : 0);
      if (strength < GAME_RULES.MIN_SOLDIERS_TO_ATTACK) continue;
      for (const to of this.#enemyCountries()) options.push(this.#evaluate(from, to, strength));
    }
    return options.sort((a, b) => b.score - a.score);
  }

  // Which owned country, if handed every reinforcement, would have the best attack next?
  #bestLaunchpad(amount) {
    let best = null;
    for (const country of this.#ownCountries()) {
      const [option] = this.#rankAttacks(country, amount).filter((o) => o.from === country);
      if (option && (!best || option.score > best.score)) best = option;
    }
    return best;
  }

  #describeAttack(option) {
    const reasons = [
      `${pct(option.odds.winChance)} chance to take ${option.to.name} (${option.to.soldiers}) with ${option.from.soldiers} soldiers from ${option.from.name}`,
      `conquest pays ${option.to.conquestReward} soldiers`,
    ];
    if (option.eliminates) reasons.push(`it would eliminate ${option.owner.name}`);
    else if (!option.owner.isNPC && this.#tuning.humanBonus > 0) reasons.push(`${option.owner.name} is the human threat`);
    else if (option.isLeader && this.#tuning.leaderBonus > 0) reasons.push(`${option.owner.name} leads the board`);
    return `${this.#label()} play: ${reasons.join('; ')}.`;
  }
}
