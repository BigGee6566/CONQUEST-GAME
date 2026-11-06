import { Game } from '../../src/engine/index.js';

// Dice that return pre-scripted rolls, so each battle outcome in a test is exact.
export class ScriptedDice {
  #rolls;

  constructor(rolls) {
    this.#rolls = [...rolls];
  }

  rollMany(count) {
    const next = this.#rolls.shift();
    if (!next || next.length !== count) {
      throw new Error(`Scripted dice expected a roll of ${count}, got ${JSON.stringify(next)}`);
    }
    return [...next].sort((a, b) => b - a);
  }
}

const PLAYERS = [
  { id: 'p1', name: 'Commander', isNPC: false, userId: 'u1', color: '#3B82F6', homeCountry: 'ZA' },
  { id: 'n1', name: 'Warlord of Namibia', isNPC: true, npcProfile: 'aggressive', color: '#EF4444', homeCountry: 'NA' },
  { id: 'n2', name: 'Guardian of India', isNPC: true, npcProfile: 'defensive', color: '#10B981', homeCountry: 'IN' },
];

const COUNTRIES = [
  { code: 'ZA', name: 'South Africa', region: 'Africa', population: 64_747_000, soldierValue: 5, soldiers: 5, ownerId: 'p1' },
  { code: 'BW', name: 'Botswana', region: 'Africa', population: 2_562_000, soldierValue: 1, soldiers: 3, ownerId: 'p1' },
  { code: 'NA', name: 'Namibia', region: 'Africa', population: 3_093_000, soldierValue: 1, soldiers: 1, ownerId: 'n1' },
  { code: 'IN', name: 'India', region: 'Asia', population: 1_463_866_000, soldierValue: 9, soldiers: 9, ownerId: 'n2' },
];

// A small hand-built board: the human (p1) holds South Africa (5) and Botswana (3),
// an aggressive NPC holds Namibia (1) and a defensive NPC holds India (9).
export function smallGame({ rolls = [], overrides = {}, countries = COUNTRIES, players = PLAYERS } = {}) {
  return new Game(
    {
      players: players.map((p) => ({ ...p })),
      countries: countries.map((c) => ({ ...c })),
      turnOrder: players.map((p) => p.id),
      ...overrides,
    },
    { dice: new ScriptedDice(rolls) },
  );
}

export function codeOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null;
}
