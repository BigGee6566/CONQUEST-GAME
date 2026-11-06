import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TURN_PHASES } from '../../src/config/gameRules.js';
import { WORLD_COUNTRIES } from '../../src/data/worldCountries.js';
import { conquestOdds, createRng, GameFactory, NpcController } from '../../src/engine/index.js';
import { smallGame } from './fixtures.js';

describe('conquestOdds', () => {
  test('heavily favours big armies and is hopeless with 2 vs 9', () => {
    assert.ok(conquestOdds(10, 1).winChance > 0.95);
    assert.ok(conquestOdds(2, 9).winChance < 0.05);
    assert.equal(conquestOdds(1, 1).winChance, 0);
  });

  test('is deterministic for a given matchup', () => {
    assert.deepEqual(conquestOdds(7, 5), conquestOdds(7, 5));
  });
});

describe('NpcController decisions', () => {
  test('an NPC picks the easy conquest and explains why', () => {
    const game = smallGame({ overrides: { turnOrder: ['n2', 'p1', 'n1'] } });
    const decision = NpcController.decide(game);
    assert.equal(decision.type, 'attack');
    assert.equal(decision.from, 'IN');
    assert.match(decision.reasoning, /chance to take/);
  });

  test('reinforcements are placed in full on owned countries', () => {
    const game = smallGame({ overrides: { turnOrder: ['n2', 'p1', 'n1'], round: 2, phase: TURN_PHASES.REINFORCE, pendingReinforcements: 6 } });
    const decision = NpcController.decide(game);
    assert.equal(decision.allocation.reduce((sum, a) => sum + a.soldiers, 0), 6);
    assert.ok(decision.allocation.every((a) => game.country(a.country).ownerId === 'n2'));
  });

  test('an NPC with no good odds holds position instead of attacking', () => {
    const game = smallGame({
      overrides: { turnOrder: ['n1', 'p1', 'n2'] },
      countries: [
        { code: 'ZA', name: 'South Africa', region: 'Africa', population: 64_747_000, soldierValue: 5, soldiers: 9, ownerId: 'p1' },
        { code: 'NA', name: 'Namibia', region: 'Africa', population: 3_093_000, soldierValue: 1, soldiers: 2, ownerId: 'n1' },
        { code: 'IN', name: 'India', region: 'Asia', population: 1_463_866_000, soldierValue: 9, soldiers: 9, ownerId: 'n2' },
      ],
    });
    const { decision, result } = NpcController.takeTurnStep(game, { createBattleId: () => 'b1' });
    assert.equal(decision.type, 'finish');
    assert.match(decision.reasoning, /holds position/);
    assert.equal(result.events[0].type, 'npc_decision');
    assert.equal(game.currentPlayer.id, 'p1');
  });
});

function assertInvariants(game) {
  const ownerIds = new Set(game.players.map((p) => p.id));
  for (const country of game.countries) {
    assert.ok(ownerIds.has(country.ownerId), `${country.name} has an unknown owner`);
    assert.ok(country.soldiers >= 1, `${country.name} was left empty`);
  }
  for (const player of game.players) {
    const held = game.countriesOf(player.id).length;
    assert.equal(player.isEliminated, held === 0, `${player.name} elimination flag disagrees with ${held} countries`);
  }
  if (!game.isOver) assert.equal(game.currentPlayer.isEliminated, false);
}

describe('full simulated games', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    test(`seed ${seed}: AI-driven game reaches an end with every rule holding`, () => {
      const rng = createRng(seed);
      const { game } = GameFactory.create({
        owner: { userId: 'u1', name: 'Commander' },
        homeCountryCode: 'ZA',
        catalog: WORLD_COUNTRIES,
        rng,
      });

      let battles = 0;
      let steps = 0;
      while (!game.isOver && steps < 20_000) {
        const { decision, result } = NpcController.takeTurnStep(game, { createBattleId: () => `b${++battles}` });
        assert.ok(decision.reasoning, `decision ${decision.type} has no justification`);
        assert.equal(result.events[0].type, 'npc_decision');
        assertInvariants(game);
        steps += 1;
      }

      assert.ok(game.isOver, `seed ${seed} did not finish within ${steps} steps (round ${game.round})`);
      if (game.endReason === 'conquest') {
        assert.equal(game.countriesOf(game.winnerId).length, 10);
      } else {
        assert.equal(game.endReason, 'defeat');
        assert.equal(game.humanPlayer.isEliminated, true);
      }
    });
  }
});
