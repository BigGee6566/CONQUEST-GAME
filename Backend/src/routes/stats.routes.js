import { Router } from 'express';
import { leaderboard, myStats, platformStats } from '../controllers/stats.controller.js';
import { authenticate } from '../middleware/auth.js';

export const statsRouter = Router();

statsRouter.get('/me', authenticate, myStats);
statsRouter.get('/leaderboard', leaderboard);
statsRouter.get('/platform', platformStats);
