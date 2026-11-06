import { GAME_RULES } from '../config/gameRules.js';

export class Dice {
  #rng;
  #faces;

  constructor(rng = Math.random, faces = GAME_RULES.DIE_FACES) {
    this.#rng = rng;
    this.#faces = faces;
  }

  roll() {
    return 1 + Math.floor(this.#rng() * this.#faces);
  }

  // Sorted highest first so dice pair up highest-vs-highest.
  rollMany(count) {
    return Array.from({ length: count }, () => this.roll()).sort((a, b) => b - a);
  }
}
