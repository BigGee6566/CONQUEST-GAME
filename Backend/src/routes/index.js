import { Router } from 'express';
import { ensureDb } from '../middleware/ensureDb.js';
import { authRouter } from './auth.routes.js';
import { countryRouter } from './country.routes.js';
import { gameRouter } from './game.routes.js';
import { healthRouter } from './health.routes.js';
import { statsRouter } from './stats.routes.js';

export const apiRouter = Router();

// Health checks run before ensureDb so they can report a database outage instead of failing with it.
apiRouter.use('/health', healthRouter);

apiRouter.use(ensureDb);
apiRouter.use('/auth', authRouter);
apiRouter.use('/countries', countryRouter);
apiRouter.use('/games', gameRouter);
apiRouter.use('/stats', statsRouter);
