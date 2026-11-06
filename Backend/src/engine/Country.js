import { GAME_RULES, MAX_SOLDIER_VALUE } from '../config/gameRules.js';
import { GameRuleError } from './errors.js';

export class Country {
  #soldiers;
  #ownerId;

  constructor({ code, name, region, population, soldierValue, soldiers, ownerId }) {
    if (!Number.isInteger(soldiers) || soldiers < 0) {
      throw new RangeError(`${name}: soldiers must be a non-negative integer`);
    }
    if (!Number.isInteger(soldierValue) || soldierValue < 1 || soldierValue > MAX_SOLDIER_VALUE) {
      throw new RangeError(`${name}: soldier value must be between 1 and ${MAX_SOLDIER_VALUE}`);
    }
    this.code = code;
    this.name = name;
    this.region = region;
    this.population = population;
    this.soldierValue = soldierValue;
    this.#soldiers = soldiers;
    this.#ownerId = String(ownerId);
    Object.freeze(this);
  }

  get soldiers() {
    return this.#soldiers;
  }

  get ownerId() {
    return this.#ownerId;
  }

  isOwnedBy(playerId) {
    return this.#ownerId === String(playerId);
  }

  canAttack() {
    return this.#soldiers >= GAME_RULES.MIN_SOLDIERS_TO_ATTACK;
  }

  // Soldiers gained by whoever conquers this country: Max(2, floor(soldier value / 2)).
  get conquestReward() {
    return Math.max(GAME_RULES.MIN_CONQUEST_REWARD, Math.floor(this.soldierValue / 2));
  }

  reinforce(amount) {
    this.#soldiers += amount;
  }

  withdraw(amount) {
    const maxMovable = this.#soldiers - GAME_RULES.MIN_SOLDIERS_LEFT_BEHIND;
    if (amount > maxMovable) {
      throw new GameRuleError(
        'MUST_LEAVE_SOLDIER',
        `${this.name} must keep at least ${GAME_RULES.MIN_SOLDIERS_LEFT_BEHIND} soldier; you can move at most ${Math.max(maxMovable, 0)}`,
      );
    }
    this.#soldiers -= amount;
  }

  loseSoldiers(amount) {
    if (amount > this.#soldiers) throw new RangeError(`${this.name} cannot lose more soldiers than it has`);
    this.#soldiers -= amount;
  }

  occupy(newOwnerId, garrison) {
    if (this.#soldiers !== 0) throw new RangeError(`${this.name} still has defenders`);
    this.#ownerId = String(newOwnerId);
    this.#soldiers = garrison;
  }

  toJSON() {
    return {
      code: this.code,
      name: this.name,
      region: this.region,
      population: this.population,
      soldierValue: this.soldierValue,
      soldiers: this.#soldiers,
      ownerId: this.#ownerId,
    };
  }
}
