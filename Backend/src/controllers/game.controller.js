import * as gameService from '../services/game.service.js';

export async function listGames(req, res) {
  res.json(await gameService.listGames(req.validated.query, req.user));
}

export async function createGame(req, res) {
  res.status(201).json(await gameService.createGame(req.user, req.validated.body));
}

export async function getGame(req, res) {
  res.json(await gameService.getGame(req.validated.params.id, req.user));
}

export async function performAction(req, res) {
  res.json(await gameService.performAction(req.validated.params.id, req.user, req.validated.body));
}

export async function advanceNpc(req, res) {
  res.json(await gameService.advanceNpc(req.validated.params.id, req.user, req.validated.body));
}

export async function abandonGame(req, res) {
  res.json(await gameService.abandonGame(req.validated.params.id, req.user));
}

export async function listEvents(req, res) {
  res.json(await gameService.listEvents(req.validated.params.id, req.user, req.validated.query));
}

export async function listBattles(req, res) {
  res.json(await gameService.listBattles(req.validated.params.id, req.user, req.validated.query));
}

export async function getBattle(req, res) {
  const { id, battleId } = req.validated.params;
  res.json(await gameService.getBattle(id, battleId, req.user));
}
