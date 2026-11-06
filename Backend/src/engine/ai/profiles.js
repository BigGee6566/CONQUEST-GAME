import { NPC_PROFILES } from '../../config/gameRules.js';

// How much the required win chance relaxes each round, so cautious NPCs cannot stall the game forever.
export const PATIENCE_DECAY_PER_ROUND = 0.01;

// minWinChance:     odds needed before launching an attack (decays toward patienceFloor)
// retreatBelow:     mid-attack, stop rolling once the odds fall below this
// offenseShare:     share of reinforcements massed on the best attack launchpad
// humanBonus etc.:  extra value placed on particular targets when scoring attacks
// lossAversion:     weight of expected soldier losses against the prize
// consolidate:      merge the second-largest army into the largest after attacking
// rebalanceShare:   otherwise, share of the strongest/weakest gap moved to the weakest garrison
export const PROFILE_TUNING = Object.freeze({
  [NPC_PROFILES.AGGRESSIVE]: Object.freeze({
    label: 'aggressive',
    minWinChance: 0.45,
    patienceFloor: 0.3,
    retreatBelow: 0.2,
    offenseShare: 1,
    // Only the aggressive personality hunts the human; nine NPCs all doing so would end the game in round 2.
    humanBonus: 0.75,
    leaderBonus: 1,
    eliminationBonus: 3,
    lossAversion: 0.3,
    consolidate: true,
    rebalanceShare: 0,
  }),
  [NPC_PROFILES.DEFENSIVE]: Object.freeze({
    label: 'defensive',
    minWinChance: 0.75,
    patienceFloor: 0.45,
    retreatBelow: 0.5,
    offenseShare: 0.25,
    humanBonus: 0,
    leaderBonus: 1,
    eliminationBonus: 2,
    lossAversion: 1.2,
    consolidate: false,
    rebalanceShare: 0.5,
  }),
  [NPC_PROFILES.BALANCED]: Object.freeze({
    label: 'balanced',
    minWinChance: 0.6,
    patienceFloor: 0.4,
    retreatBelow: 0.35,
    offenseShare: 0.6,
    humanBonus: 0,
    leaderBonus: 1.5,
    eliminationBonus: 3,
    lossAversion: 0.7,
    consolidate: false,
    rebalanceShare: 0.33,
  }),
  [NPC_PROFILES.OPPORTUNIST]: Object.freeze({
    label: 'opportunist',
    minWinChance: 0.55,
    patienceFloor: 0.35,
    retreatBelow: 0.4,
    offenseShare: 0.8,
    humanBonus: 0,
    leaderBonus: 0,
    eliminationBonus: 5,
    lossAversion: 0.6,
    consolidate: false,
    rebalanceShare: 0.25,
  }),
});

export function tuningFor(profile) {
  return PROFILE_TUNING[profile] ?? PROFILE_TUNING[NPC_PROFILES.BALANCED];
}
