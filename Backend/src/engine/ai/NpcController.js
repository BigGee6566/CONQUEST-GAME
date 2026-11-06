import { TURN_PHASES } from '../../config/gameRules.js';
import { ActionResult } from '../ActionResult.js';
import { GameRuleError } from '../errors.js';
import { NpcStrategy } from './NpcStrategy.js';

function describe(decision, game) {
  switch (decision.type) {
    case 'reinforce': {
      const total = decision.allocation.reduce((sum, a) => sum + a.soldiers, 0);
      return `deploy ${total} reinforcements`;
    }
    case 'attack':
      return `attack ${game.country(decision.to).name} from ${game.country(decision.from).name}`;
    case 'roll':
      return 'keep rolling';
    case 'stop':
      return 'call off the attack';
    default:
      return decision.transfers.length ? 'reposition troops and end the turn' : 'end the turn';
  }
}

// Drives NPC turns one visible step at a time: each call decides and plays a single move
// (deploy, attack, one dice roll, stop, or reposition + end turn). The client calls it
// repeatedly, slower or faster for fast-forward, so every move stays on screen.
export class NpcController {
  static decide(game) {
    if (game.isOver) throw new GameRuleError('GAME_OVER', 'The game is over');
    const strategy = new NpcStrategy(game, game.currentPlayer);

    switch (game.phase) {
      case TURN_PHASES.REINFORCE: {
        const { allocation, reasoning } = strategy.planReinforcements();
        return { type: 'reinforce', allocation, reasoning };
      }
      case TURN_PHASES.ATTACKING: {
        const { continueAttack, reasoning } = strategy.shouldContinueAttack();
        return { type: continueAttack ? 'roll' : 'stop', reasoning };
      }
      case TURN_PHASES.ACTION: {
        if (!game.hasAttackedThisTurn) {
          const { attack, reasoning } = strategy.chooseAttack();
          if (attack) return { type: 'attack', ...attack, reasoning };
          return { type: 'finish', transfers: strategy.planTransfers(), reasoning };
        }
        const transfers = strategy.planTransfers();
        return {
          type: 'finish',
          transfers,
          reasoning: transfers.length
            ? 'Attack resolved; repositioning before ending the turn.'
            : 'Attack resolved; the lines are set, ending the turn.',
        };
      }
      default:
        throw new GameRuleError('WRONG_PHASE', `Cannot act during phase "${game.phase}"`);
    }
  }

  // Applies a decision through the same rule-checked commands a human uses, so NPCs cannot cheat.
  static execute(game, decision, { battleId } = {}) {
    const player = game.currentPlayer;
    const result = new ActionResult().add(game.createEvent(
      'npc_decision',
      `${player.name} decides to ${describe(decision, game)}`,
      { actor: player, reasoning: decision.reasoning, data: { decision: decision.type } },
    ));

    if (decision.type === 'finish') {
      for (const move of decision.transfers) {
        result.merge(game.transfer(player.id, move.from, move.to, move.soldiers).annotate(move.reasoning));
      }
      return result.merge(game.endTurn(player.id));
    }
    return result.merge(game.perform(player.id, { ...decision, battleId }));
  }

  static takeTurnStep(game, { createBattleId }) {
    const decision = NpcController.decide(game);
    const battleId = decision.type === 'attack' ? createBattleId() : undefined;
    return { decision, result: NpcController.execute(game, decision, { battleId }) };
  }
}
