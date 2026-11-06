import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import mongoose from 'mongoose';
import { GAME_RULES, PLAYER_COLORS, soldierValueForPopulation } from '../src/config/gameRules.js';
import { WORLD_COUNTRIES } from '../src/data/worldCountries.js';
import { Battle, Game, User, WorldCountry } from '../src/models/index.js';

function buildGame() {
  const owner = new mongoose.Types.ObjectId();
  const picked = WORLD_COUNTRIES.slice(0, GAME_RULES.TOTAL_COUNTRIES);
  const players = picked.map((country, i) => ({
    _id: new mongoose.Types.ObjectId(),
    name: i === 0 ? 'Player One' : `General ${country.name}`,
    isNPC: i !== 0,
    user: i === 0 ? owner : null,
    npcProfile: i === 0 ? null : 'balanced',
    color: PLAYER_COLORS[i],
    homeCountry: country.code,
  }));
  const countries = picked.map((country, i) => {
    const soldierValue = soldierValueForPopulation(country.population);
    return { ...country, soldierValue, soldiers: soldierValue, owner: players[i]._id };
  });
  return new Game({ owner, players, countries, turnOrder: players.map((p) => p._id) });
}

async function validationPaths(doc) {
  try {
    await doc.validate();
    return [];
  } catch (err) {
    return Object.keys(err.errors);
  }
}

describe('soldierValueForPopulation', () => {
  test('follows the population table from the brief, with inclusive upper bounds', () => {
    assert.equal(soldierValueForPopulation(501), 1);
    assert.equal(soldierValueForPopulation(5_000_000), 1);
    assert.equal(soldierValueForPopulation(5_000_001), 2);
    assert.equal(soldierValueForPopulation(25_000_000), 3);
    assert.equal(soldierValueForPopulation(150_000_000), 8);
    assert.equal(soldierValueForPopulation(150_000_001), 9);
    assert.equal(soldierValueForPopulation(1_463_866_000), 9);
  });

  test('rejects nonsense populations', () => {
    assert.throws(() => soldierValueForPopulation(-1), RangeError);
    assert.throws(() => soldierValueForPopulation(Number.NaN), RangeError);
  });
});

describe('WorldCountry catalogue', () => {
  test('has unique codes and names, and every entry passes schema validation', async () => {
    assert.equal(new Set(WORLD_COUNTRIES.map((c) => c.code)).size, WORLD_COUNTRIES.length);
    assert.equal(new Set(WORLD_COUNTRIES.map((c) => c.name)).size, WORLD_COUNTRIES.length);
    for (const country of WORLD_COUNTRIES) {
      assert.deepEqual(await validationPaths(new WorldCountry(country)), [], country.name);
    }
  });

  test('derives soldier value and flag from the stored data', async () => {
    const india = new WorldCountry({ code: 'IN', name: 'India', region: 'Asia', population: 1_463_866_000 });
    await india.validate();
    assert.equal(india.soldierValue, 9);
    assert.equal(india.flag, '\u{1F1EE}\u{1F1F3}');
  });
});

describe('Game schema', () => {
  test('accepts a well-formed 10-player game', async () => {
    assert.deepEqual(await validationPaths(buildGame()), []);
  });

  test('rejects a game without exactly ten countries', async () => {
    const game = buildGame();
    game.countries.pop();
    assert.ok((await validationPaths(game)).includes('countries'));
  });

  test('rejects a country owned by someone outside the game', async () => {
    const game = buildGame();
    game.countries[0].owner = new mongoose.Types.ObjectId();
    assert.ok((await validationPaths(game)).includes('countries'));
  });

  test('requires exactly one human player', async () => {
    const game = buildGame();
    game.players[1].isNPC = false;
    assert.ok((await validationPaths(game)).includes('players'));
  });

  test('requires the human player to be linked to a user account', async () => {
    const game = buildGame();
    game.players[0].user = null;
    assert.deepEqual(await validationPaths(game), ['players.0.user']);
  });

  test('exposes the current player and owned countries', () => {
    const game = buildGame();
    assert.equal(String(game.currentPlayerId), String(game.players[0]._id));
    assert.equal(game.countriesOwnedBy(game.players[0]._id).length, 1);
    assert.equal(game.humanPlayer.name, 'Player One');
  });
});

describe('Battle schema', () => {
  test('requires paired dice in every exchange', async () => {
    const battle = new Battle({
      game: new mongoose.Types.ObjectId(),
      round: 1,
      turnNumber: 1,
      attacker: { player: new mongoose.Types.ObjectId(), name: 'A', country: 'ZA', countryName: 'South Africa', startingSoldiers: 5 },
      defender: { player: new mongoose.Types.ObjectId(), name: 'B', country: 'NA', countryName: 'Namibia', startingSoldiers: 1 },
      exchanges: [{ attackerDice: [6, 2], defenderDice: [3], attackerLosses: 0, defenderLosses: 1, attackerRemaining: 5, defenderRemaining: 0 }],
    });
    assert.ok((await validationPaths(battle)).includes('exchanges.0.defenderDice'));
  });
});

describe('User model', () => {
  test('hashes passwords, verifies them, and never serialises the hash', async () => {
    const user = new User({ username: 'commander_1', email: 'Commander@Example.com' });
    await user.setPassword('correct horse battery');
    assert.notEqual(user.passwordHash, 'correct horse battery');
    assert.equal(await user.comparePassword('correct horse battery'), true);
    assert.equal(await user.comparePassword('wrong password'), false);
    assert.equal(user.email, 'commander@example.com');
    assert.equal('passwordHash' in user.toJSON(), false);
    assert.deepEqual(await validationPaths(user), []);
  });

  test('rejects malformed usernames and emails', async () => {
    const user = new User({ username: 'no spaces!', email: 'not-an-email', passwordHash: 'x' });
    const paths = await validationPaths(user);
    assert.ok(paths.includes('username'));
    assert.ok(paths.includes('email'));
  });
});
