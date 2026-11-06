import { GAME_RULES } from '../config/gameRules.js';
import { Dice } from './Dice.js';
import { GameRuleError } from './errors.js';

export class BattleEngine {
  #dice;

  constructor(dice = new Dice()) {
    this.#dice = dice;
  }

  // One die per fighting soldier; the attacker must leave one behind, so it fights with
  // (soldiers - 1), and both sides roll as many dice as the smaller force.
  static diceCount(attackerSoldiers, defenderSoldiers) {
    const attackers = attackerSoldiers - GAME_RULES.MIN_SOLDIERS_LEFT_BEHIND;
    return Math.max(0, Math.min(attackers, defenderSoldiers));
  }

  // Pairs dice in order (both arrays sorted highest first); the lower die loses a soldier, ties lose nothing.
  static compare(attackerDice, defenderDice) {
    const pairs = attackerDice.map((attacker, i) => {
      const defender = defenderDice[i];
      const winner = attacker > defender ? 'attacker' : defender > attacker ? 'defender' : 'tie';
      return { attacker, defender, winner };
    });
    return {
      pairs,
      attackerLosses: pairs.filter((p) => p.winner === 'defender').length,
      defenderLosses: pairs.filter((p) => p.winner === 'attacker').length,
    };
  }

  rollExchange(attacker, defender) {
    const count = BattleEngine.diceCount(attacker.soldiers, defender.soldiers);
    if (count < 1) {
      throw new GameRuleError('ATTACK_NOT_POSSIBLE', `${attacker.name} has no soldiers free to fight`);
    }
    const attackerDice = this.#dice.rollMany(count);
    const defenderDice = this.#dice.rollMany(count);
    const { pairs, attackerLosses, defenderLosses } = BattleEngine.compare(attackerDice, defenderDice);

    attacker.loseSoldiers(attackerLosses);
    defender.loseSoldiers(defenderLosses);

    return {
      attackerDice,
      defenderDice,
      pairs,
      attackerLosses,
      defenderLosses,
      attackerRemaining: attacker.soldiers,
      defenderRemaining: defender.soldiers,
    };
  }
}
