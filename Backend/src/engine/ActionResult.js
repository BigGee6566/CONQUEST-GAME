// What a game action produced: the events to append to the activity feed and, for attacks,
// the battle data (start, dice exchange, outcome) the service layer persists to Battle.
export class ActionResult {
  #events = [];
  #battle = null;

  add(event) {
    this.#events.push(event);
    return this;
  }

  setBattle(patch) {
    this.#battle = { ...(this.#battle ?? {}), ...patch };
    return this;
  }

  merge(other) {
    other.events.forEach((event) => this.add(event));
    if (other.battle) this.setBattle(other.battle);
    return this;
  }

  // Attaches an NPC's justification to the first event this action produced.
  annotate(reasoning) {
    if (this.#events[0]) this.#events[0] = { ...this.#events[0], reasoning };
    return this;
  }

  get events() {
    return [...this.#events];
  }

  get battle() {
    return this.#battle ? { ...this.#battle } : null;
  }
}
