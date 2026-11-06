import * as statsService from '../services/stats.service.js';

export async function myStats(req, res) {
  res.json(await statsService.myStats(req.user));
}

export async function leaderboard(_req, res) {
  res.json(await statsService.leaderboard());
}

export async function platformStats(_req, res) {
  res.json(await statsService.platformStats());
}
