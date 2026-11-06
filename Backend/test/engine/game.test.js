import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import mongoose from 'mongoose';
import { GAME_STATUS, NPC_PROFILES, TURN_PHASES } from '../../src/config/gameRules.js';
import { WORLD_COUNTRIES } from '../../src/data/worldCountries.js';
import { createRng, END_REASONS, GameFactory, GameMapper } from '../../src/engine/index.js';
import { Game as GameModel } from '../../src/models/index.js';
import { codeOf, smallGame } from './fixtures.js';

const types = (result) => result.events.map((e) => e.type);

describe('GameFactory', () => {
  const { game, result } = GameFactory.create({
    owner: { userId: new mongoose.Types.ObjectId().toString(), name: 'Commander' },
    homeCountryCode: 'za',
    catalog: WORLD_COUNTRIES,
    rng: createRng(42),
  });

  test('sets up 10 unique countries: the chosen one for the human and 9 random NPC rivals', () => {
    assert.equal(game.countries.length, 10);
    assert.equal(new Set(game.countries.map((c) => c.code)).size, 10);
    assert.equal(game.players.filter((p) => p.isNPC).length, 9);
    const human = game.humanPlayer;
    assert.equal(human.homeCountry, 'ZA');
    assert.deepEqual(game.countriesOf(human.id).map((c) => c.code), ['ZA']);
  });

  test('every country starts with its full population-based soldier value', () => {
    for (const country of game.countries) assert.equal(country.soldiers, country.soldierValue);
    assert.equal(game.country('ZA').soldiers, 5);
  });

  test('spreads all four NPC personalities and shuffles the turn order', () => {
    const profiles = new Set(game.players.filter((p) => p.isNPC).map((p) => p.npcProfile));
    assert.deepEqual([...profiles].sort(), Object.values(NPC_PROFILES).sort());
    assert.deepEqual([...game.turnOrder].sort(), game.players.map((p) => p.id).sort());
  });

  test('round 1 starts without reinforcements', () => {
    assert.equal(game.round, 1);
    assert.equal(game.phase, TURN_PHASES.ACTION);
    assert.deepEqual(types(result), ['game_created', 'turn_started']);
  });

  test('round-trips through the Mongoose schema and mapper without losing state', async () => {
    const doc = new GameModel({ owner: new mongoose.Types.ObjectId(), ...GameMapper.toPersistence(game) });
    await doc.validate();
    assert.deepEqual(GameMapper.toDomain(doc).toState(), game.toState());
  });
});

describe('Game turn rules', () => {
  test('only the current player may act', () => {
    assert.equal(codeOf(() => smallGame().endTurn('n1')), 'NOT_YOUR_TURN');
  });

  test('transfers must leave at least one soldier behind', () => {
    const game = smallGame();
    assert.equal(codeOf(() => game.transfer('p1', 'ZA', 'BW', 5)), 'MUST_LEAVE_SOLDIER');
    game.transfer('p1', 'ZA', 'BW', 4);
    assert.equal(game.country('ZA').soldiers, 1);
    assert.equal(game.country('BW').soldiers, 7);
    assert.equal(codeOf(() => game.transfer('p1', 'ZA', 'NA', 1)), 'NOT_YOUR_COUNTRY');
  });

  test('attacks need 2 soldiers, an enemy target and only happen once per turn', () => {
    const game = smallGame({ rolls: [[6], [2]] });
    game.transfer('p1', 'BW', 'ZA', 2);
    assert.equal(codeOf(() => game.beginAttack('p1', 'BW', 'NA', 'b1')), 'NOT_ENOUGH_SOLDIERS');
    assert.equal(codeOf(() => game.beginAttack('p1', 'ZA', 'BW', 'b1')), 'OWN_COUNTRY');

    game.beginAttack('p1', 'ZA', 'NA', 'b1');
    assert.equal(codeOf(() => game.transfer('p1', 'ZA', 'BW', 1)), 'WRONG_PHASE');
    game.rollAttack('p1');
    assert.equal(codeOf(() => game.beginAttack('p1', 'ZA', 'IN', 'b2')), 'ALREADY_ATTACKED');
  });

  test('conquest transfers the country, grants Max(2, value/2) and eliminates a wiped-out player', () => {
    const game = smallGame({ rolls: [[6], [2]] });
    game.beginAttack('p1', 'ZA', 'NA', 'b1');
    const result = game.rollAttack('p1');

    assert.deepEqual(types(result), ['dice_rolled', 'country_conquered', 'player_eliminated']);
    assert.equal(game.country('NA').ownerId, 'p1');
    assert.equal(game.country('NA').soldiers, 2);
    assert.equal(game.player('n1').isEliminated, true);
    assert.deepEqual(
      { outcome: result.battle.outcome, soldiersGained: result.battle.soldiersGained },
      { outcome: 'conquered', soldiersGained: 2 },
    );
    assert.equal(game.phase, TURN_PHASES.ACTION);
    game.transfer('p1', 'ZA', 'NA', 2);
    assert.equal(game.country('NA').soldiers, 4);
  });

  test('the attack collapses when the attacker is down to 1 soldier', () => {
    const game = smallGame({ rolls: [[2, 1], [6, 5]] });
    game.beginAttack('p1', 'BW', 'IN', 'b1');
    const result = game.rollAttack('p1');
    assert.equal(result.battle.outcome, 'repelled');
    assert.equal(game.country('BW').soldiers, 1);
    assert.equal(game.country('IN').ownerId, 'n2');
    assert.equal(game.phase, TURN_PHASES.ACTION);
  });

  test('stopping an attack keeps the survivors and ends the turn', () => {
    const game = smallGame({ rolls: [[3, 3, 3, 3], [3, 3, 3, 3]] });
    game.beginAttack('p1', 'ZA', 'IN', 'b1');
    game.rollAttack('p1');
    const result = game.stopAttack('p1');
    assert.deepEqual(types(result), ['attack_stopped', 'turn_ended', 'turn_started']);
    assert.equal(game.country('ZA').soldiers, 5);
    assert.equal(game.currentPlayer.id, 'n1');
  });

  test('from round 2 each turn starts with 2 soldiers per country, which must be placed first', () => {
    const game = smallGame();
    game.endTurn('p1');
    game.endTurn('n1');
    const result = game.endTurn('n2');

    assert.equal(game.round, 2);
    assert.equal(game.currentPlayer.id, 'p1');
    assert.deepEqual(types(result), ['turn_skipped', 'turn_started', 'reinforcements_received']);
    assert.equal(game.pendingReinforcements, 4);
    assert.equal(codeOf(() => game.endTurn('p1')), 'WRONG_PHASE');
    assert.equal(codeOf(() => game.placeReinforcements('p1', [{ country: 'ZA', soldiers: 5 }])), 'TOO_MANY_REINFORCEMENTS');
    assert.equal(codeOf(() => game.placeReinforcements('p1', [{ country: 'IN', soldiers: 1 }])), 'NOT_YOUR_COUNTRY');

    game.placeReinforcements('p1', [{ country: 'ZA', soldiers: 3 }, { country: 'BW', soldiers: 1 }]);
    assert.equal(game.country('ZA').soldiers, 8);
    assert.equal(game.phase, TURN_PHASES.ACTION);
  });

  test('eliminated players are skipped in the turn order', () => {
    const game = smallGame({ rolls: [[6], [2]] });
    game.beginAttack('p1', 'ZA', 'NA', 'b1');
    game.rollAttack('p1');
    game.endTurn('p1');
    assert.equal(game.currentPlayer.id, 'n2');
  });

  test('conquering every country wins the game and freezes it', () => {
    const game = smallGame({
      rolls: [[6], [1]],
      players: [
        { id: 'p1', name: 'Commander', isNPC: false, userId: 'u1', color: '#3B82F6', homeCountry: 'ZA' },
        { id: 'n1', name: 'Warlord of Namibia', isNPC: true, npcProfile: 'aggressive', color: '#EF4444', homeCountry: 'NA' },
      ],
      countries: [
        { code: 'ZA', name: 'South Africa', region: 'Africa', population: 64_747_000, soldierValue: 5, soldiers: 5, ownerId: 'p1' },
        { code: 'NA', name: 'Namibia', region: 'Africa', population: 3_093_000, soldierValue: 1, soldiers: 1, ownerId: 'n1' },
      ],
    });
    game.beginAttack('p1', 'ZA', 'NA', 'b1');
    const result = game.rollAttack('p1');
    assert.ok(types(result).includes('game_won'));
    assert.equal(game.status, GAME_STATUS.COMPLETED);
    assert.equal(game.winnerId, 'p1');
    assert.equal(game.endReason, END_REASONS.CONQUEST);
    assert.equal(codeOf(() => game.endTurn('p1')), 'GAME_OVER');
  });

  test('losing the last human country ends the game in defeat', () => {
    const game = smallGame({
      rolls: [[6, 6], [1, 1]],
      overrides: { turnOrder: ['n2', 'p1', 'n1'] },
      countries: [
        { code: 'ZA', name: 'South Africa', region: 'Africa', population: 64_747_000, soldierValue: 5, soldiers: 2, ownerId: 'p1' },
        { code: 'NA', name: 'Namibia', region: 'Africa', population: 3_093_000, soldierValue: 1, soldiers: 1, ownerId: 'n1' },
        { code: 'IN', name: 'India', region: 'Asia', population: 1_463_866_000, soldierValue: 9, soldiers: 9, ownerId: 'n2' },
      ],
    });
    game.beginAttack('n2', 'IN', 'ZA', 'b1');
    const result = game.rollAttack('n2');
    assert.ok(types(result).includes('game_over'));
    assert.equal(game.endReason, END_REASONS.DEFEAT);
    assert.equal(game.winnerId, null);
  });

  test('state survives a persistence round trip mid-attack', () => {
    const game = smallGame();
    game.beginAttack('p1', 'ZA', 'IN', 'b1');
    const restored = GameMapper.toDomain(GameMapper.toPersistence(game));
    assert.deepEqual(restored.toState(), game.toState());
    assert.equal(restored.phase, TURN_PHASES.ATTACKING);
  });
});
