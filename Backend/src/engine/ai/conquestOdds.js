import { GAME_RULES } from '../../config/gameRules.js';
import { BattleEngine } from '../BattleEngine.js';
import { Dice } from '../Dice.js';
import { createRng } from '../random.js';

const TRIALS = 300;
const MAX_CACHED = 5_000;
const cache = new Map();

// Monte Carlo estimate of an attack fought to the end (conquest or the attacker reduced to 1),
// using the real battle rules. Seeded per matchup so the same board always yields the same odds,
// and cached so warm serverless instances do not re-simulate.
export function conquestOdds(attackerSoldiers, defenderSoldiers) {
  if (attackerSoldiers < GAME_RULES.MIN_SOLDIERS_TO_ATTACK) return { winChance: 0, expectedAttackerLosses: 0 };
  if (defenderSoldiers <= 0) return { winChance: 1, expectedAttackerLosses: 0 };

  const key = `${attackerSoldiers}:${defenderSoldiers}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const dice = new Dice(createRng(key));
  let wins = 0;
  let totalLosses = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    let attackers = attackerSoldiers;
    let defenders = defenderSoldiers;
    while (attackers >= GAME_RULES.MIN_SOLDIERS_TO_ATTACK && defenders > 0) {
      const count = BattleEngine.diceCount(attackers, defenders);
      const { attackerLosses, defenderLosses } = BattleEngine.compare(dice.rollMany(count), dice.rollMany(count));
      attackers -= attackerLosses;
      defenders -= defenderLosses;
    }
    if (defenders === 0) wins += 1;
    totalLosses += attackerSoldiers - attackers;
  }

  const odds = Object.freeze({ winChance: wins / TRIALS, expectedAttackerLosses: totalLosses / TRIALS });
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, odds);
  return odds;
}
