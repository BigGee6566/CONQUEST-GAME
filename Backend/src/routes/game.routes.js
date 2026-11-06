import { Router } from 'express';
import {
  abandonGame,
  advanceNpc,
  createGame,
  getBattle,
  getGame,
  listBattles,
  listEvents,
  listGames,
  performAction,
} from '../controllers/game.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  battleParams,
  battlesQuery,
  createGameSchema,
  eventsQuery,
  gameActionSchema,
  listGamesQuery,
  npcStepSchema,
} from '../validators/game.schemas.js';

export const gameRouter = Router();

// Viewing is open to spectators (optionalAuth); playing requires the owner's JWT (authenticate).
gameRouter.get('/', optionalAuth, validate({ query: listGamesQuery }), listGames);
gameRouter.post('/', authenticate, validate({ body: createGameSchema }), createGame);
gameRouter.get('/:id', optionalAuth, validate({ params: idParams }), getGame);
gameRouter.get('/:id/events', optionalAuth, validate({ params: idParams, query: eventsQuery }), listEvents);
gameRouter.get('/:id/battles', optionalAuth, validate({ params: idParams, query: battlesQuery }), listBattles);
gameRouter.get('/:id/battles/:battleId', optionalAuth, validate({ params: battleParams }), getBattle);
gameRouter.post('/:id/actions', authenticate, validate({ params: idParams, body: gameActionSchema }), performAction);
gameRouter.post('/:id/npc-step', authenticate, validate({ params: idParams, body: npcStepSchema }), advanceNpc);
gameRouter.post('/:id/abandon', authenticate, validate({ params: idParams }), abandonGame);
