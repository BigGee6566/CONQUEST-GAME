// Rules from the INF4001 Geopolitics case study, kept in one place so the
// models, game engine and NPC AI all read the same numbers.

export const GAME_RULES = Object.freeze({
  TOTAL_COUNTRIES: 10,
  NPC_COUNT: 9,
  DIE_FACES: 6,
  MIN_SOLDIERS_TO_ATTACK: 2,
  MIN_SOLDIERS_LEFT_BEHIND: 1,
  REINFORCEMENTS_PER_COUNTRY: 2,
  REINFORCEMENTS_START_ROUND: 2,
  MIN_CONQUEST_REWARD: 2,
});

// [inclusive population upper bound, soldiers]; anything larger is MAX_SOLDIER_VALUE.
export const POPULATION_TIERS = Object.freeze([
  [5_000_000, 1],
  [10_000_000, 2],
  [25_000_000, 3],
  [50_000_000, 4],
  [75_000_000, 5],
  [100_000_000, 6],
  [125_000_000, 7],
  [150_000_000, 8],
]);

export const MAX_SOLDIER_VALUE = 9;

export function soldierValueForPopulation(population) {
  if (!Number.isFinite(population) || population < 0) {
    throw new RangeError(`Population must be a non-negative number, got ${population}`);
  }
  const tier = POPULATION_TIERS.find(([limit]) => population <= limit);
  return tier ? tier[1] : MAX_SOLDIER_VALUE;
}

export const NPC_PROFILES = Object.freeze({
  AGGRESSIVE: 'aggressive',
  DEFENSIVE: 'defensive',
  BALANCED: 'balanced',
  OPPORTUNIST: 'opportunist',
});

export const GAME_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
});

export const TURN_PHASES = Object.freeze({
  REINFORCE: 'reinforce',
  ACTION: 'action',
  ATTACKING: 'attacking',
  GAME_OVER: 'game_over',
});

export const BATTLE_OUTCOMES = Object.freeze({
  IN_PROGRESS: 'in_progress',
  CONQUERED: 'conquered',
  REPELLED: 'repelled',
  STOPPED: 'stopped',
});

export const REGIONS = Object.freeze([
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
]);

export const PLAYER_COLORS = Object.freeze([
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
]);
