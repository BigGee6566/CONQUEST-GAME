import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BattleEngine, Country, Dice, createRng } from '../../src/engine/index.js';
import { ScriptedDice } from './fixtures.js';

const country = (code, soldiers, soldierValue = 1) =>
  new Country({ code, name: code, region: 'Africa', population: 1, soldierValue, soldiers, ownerId: code });

describe('BattleEngine.diceCount (examples from the brief)', () => {
  test('attacker 10 vs defender 2 rolls 2 dice each', () => assert.equal(BattleEngine.diceCount(10, 2), 2));
  test('attacker 3 vs defender 5 rolls 2 dice each', () => assert.equal(BattleEngine.diceCount(3, 5), 2));
  test('attacker 2 vs defender 5 rolls 1 die each', () => assert.equal(BattleEngine.diceCount(2, 5), 1));
  test('an attacker with 1 soldier cannot roll', () => assert.equal(BattleEngine.diceCount(1, 5), 0));
});

describe('BattleEngine.compare', () => {
  test('the brief example: 4 beats 3, 1 loses to 2, both sides lose one soldier', () => {
    const { attackerLosses, defenderLosses } = BattleEngine.compare([4, 1], [3, 2]);
    assert.equal(attackerLosses, 1);
    assert.equal(defenderLosses, 1);
  });

  test('ties kill nobody', () => {
    const { attackerLosses, defenderLosses, pairs } = BattleEngine.compare([5, 3], [5, 3]);
    assert.equal(attackerLosses + defenderLosses, 0);
    assert.deepEqual(pairs.map((p) => p.winner), ['tie', 'tie']);
  });
});

describe('BattleEngine.rollExchange', () => {
  test('applies losses to both countries and reports what remains', () => {
    const engine = new BattleEngine(new ScriptedDice([[6, 2], [3, 4]]));
    const attacker = country('AA', 10);
    const defender = country('DD', 2);
    const exchange = engine.rollExchange(attacker, defender);
    assert.deepEqual(exchange.attackerDice, [6, 2]);
    assert.deepEqual(exchange.defenderDice, [4, 3]);
    assert.equal(attacker.soldiers, 9);
    assert.equal(defender.soldiers, 1);
    assert.equal(exchange.attackerRemaining, 9);
  });

  test('the attacker always keeps at least one soldier, whatever the dice', () => {
    const engine = new BattleEngine(new Dice(createRng('keep-one')));
    for (let i = 0; i < 200; i += 1) {
      const attacker = country('AA', 2 + (i % 8));
      const defender = country('DD', 1 + (i % 6));
      while (attacker.canAttack() && defender.soldiers > 0) engine.rollExchange(attacker, defender);
      assert.ok(attacker.soldiers >= 1);
      assert.ok(defender.soldiers >= 0);
    }
  });
});

describe('Country.conquestReward', () => {
  test('India (value 9) grants Max(2, 9/2) = 4', () => assert.equal(country('IN', 0, 9).conquestReward, 4));
  test('Vatican City (value 1) grants Max(2, 1/2) = 2', () => assert.equal(country('VA', 0, 1).conquestReward, 2));
});

describe('Dice', () => {
  test('rolls stay within 1-6 and come back sorted highest first', () => {
    const dice = new Dice(createRng(7));
    const rolls = dice.rollMany(50);
    assert.ok(rolls.every((r) => r >= 1 && r <= 6));
    assert.deepEqual(rolls, [...rolls].sort((a, b) => b - a));
  });
});
