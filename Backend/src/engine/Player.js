const EMPTY_STATS = Object.freeze({ attacksLaunched: 0, conquests: 0, soldiersLost: 0, soldiersKilled: 0 });

export class Player {
  #isEliminated;
  #eliminatedInRound;
  #stats;

  constructor({
    id,
    name,
    isNPC,
    userId = null,
    npcProfile = null,
    color,
    homeCountry,
    isEliminated = false,
    eliminatedInRound = null,
    stats = EMPTY_STATS,
  }) {
    if (!id || !name) throw new TypeError('A player needs an id and a name');
    this.id = String(id);
    this.name = name;
    this.isNPC = Boolean(isNPC);
    this.userId = userId ? String(userId) : null;
    this.npcProfile = npcProfile;
    this.color = color;
    this.homeCountry = homeCountry;
    this.#isEliminated = isEliminated;
    this.#eliminatedInRound = eliminatedInRound;
    this.#stats = { ...EMPTY_STATS, ...stats };
    Object.freeze(this);
  }

  get isEliminated() {
    return this.#isEliminated;
  }

  get eliminatedInRound() {
    return this.#eliminatedInRound;
  }

  get stats() {
    return { ...this.#stats };
  }

  isControlledBy(userId) {
    return !this.isNPC && this.userId !== null && this.userId === String(userId);
  }

  eliminate(round) {
    this.#isEliminated = true;
    this.#eliminatedInRound = round;
  }

  recordAttack() {
    this.#stats.attacksLaunched += 1;
  }

  recordConquest() {
    this.#stats.conquests += 1;
  }

  recordCasualties({ lost, killed }) {
    this.#stats.soldiersLost += lost;
    this.#stats.soldiersKilled += killed;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      isNPC: this.isNPC,
      userId: this.userId,
      npcProfile: this.npcProfile,
      color: this.color,
      homeCountry: this.homeCountry,
      isEliminated: this.#isEliminated,
      eliminatedInRound: this.#eliminatedInRound,
      stats: this.stats,
    };
  }
}
