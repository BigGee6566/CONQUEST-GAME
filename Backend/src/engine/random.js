import { randomInt } from 'node:crypto';

// Seedable randomness so battles, NPC odds and tests are reproducible.
// Without a seed the engine uses Math.random.

// Cryptographically secure source for real games, so dice rolls cannot be predicted.
export function secureRandom() {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

function hashSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let hash = 2166136261;
  for (const ch of String(seed)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast PRNG returning floats in [0, 1).
export function createRng(seed) {
  if (seed === undefined) return Math.random;
  let state = hashSeed(seed);
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
