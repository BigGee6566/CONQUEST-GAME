import { randomBytes } from 'node:crypto';
import {
  GAME_RULES,
  GAME_STATUS,
  NPC_PROFILES,
  PLAYER_COLORS,
  soldierValueForPopulation,
  TURN_PHASES,
} from '../config/gameRules.js';
import { Dice } from './Dice.js';
import { GameRuleError } from './errors.js';
import { Game } from './Game.js';
import { shuffle } from './random.js';

const NPC_TITLES = Object.freeze({
  [NPC_PROFILES.AGGRESSIVE]: 'Warlord',
  [NPC_PROFILES.DEFENSIVE]: 'Guardian',
  [NPC_PROFILES.BALANCED]: 'General',
  [NPC_PROFILES.OPPORTUNIST]: 'Strategist',
});

// 24 hex characters is a valid MongoDB ObjectId, so ids can be persisted as-is.
const defaultId = () => randomBytes(12).toString('hex');

export class GameFactory {
  // catalog: world countries ({ code, name, region, population }) to draw the 9 rivals from.
  static create({ owner, homeCountryCode, catalog, rng = Math.random, generateId = defaultId, dice }) {
    const { NPC_COUNT } = GAME_RULES;
    const home = catalog.find((c) => c.code === String(homeCountryCode).toUpperCase());
    if (!home) throw new GameRuleError('UNKNOWN_COUNTRY', `Unknown starting country "${homeCountryCode}"`);

    const rivals = shuffle(catalog.filter((c) => c.code !== home.code), rng).slice(0, NPC_COUNT);
    if (rivals.length < NPC_COUNT) {
      throw new GameRuleError('NOT_ENOUGH_COUNTRIES', `At least ${NPC_COUNT + 1} countries are needed to start a game`);
    }

    // Spread the four personalities across the nine NPCs.
    const profilePool = Object.values(NPC_PROFILES);
    const profiles = shuffle(
      Array.from({ length: NPC_COUNT }, (_, i) => profilePool[i % profilePool.length]),
      rng,
    );

    const lineup = [home, ...rivals];
    const players = lineup.map((country, i) => {
      const isNPC = i > 0;
      const npcProfile = isNPC ? profiles[i - 1] : null;
      return {
        id: generateId(),
        name: isNPC ? `${NPC_TITLES[npcProfile]} of ${country.name}` : owner.name,
        isNPC,
        userId: isNPC ? null : String(owner.userId),
        npcProfile,
        color: PLAYER_COLORS[i],
        homeCountry: country.code,
      };
    });

    const countries = lineup.map((country, i) => {
      const soldierValue = soldierValueForPopulation(country.population);
      return {
        code: country.code,
        name: country.name,
        region: country.region,
        population: country.population,
        soldierValue,
        soldiers: soldierValue,
        ownerId: players[i].id,
      };
    });

    const game = new Game(
      {
        players,
        countries,
        turnOrder: shuffle(players.map((p) => p.id), rng),
        currentTurnIndex: 0,
        round: 1,
        turnNumber: 1,
        phase: TURN_PHASES.ACTION,
        status: GAME_STATUS.ACTIVE,
      },
      { dice: dice ?? new Dice(rng) },
    );
    return { game, result: game.start() };
  }
}
