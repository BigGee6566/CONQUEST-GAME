import { Router } from 'express';
import { getAiHealth, getDatabaseHealth, getHealth } from '../controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/db', getDatabaseHealth);
healthRouter.get('/ai', getAiHealth);
