import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { sanitizeInput } from './middleware/sanitizeInput.js';
import { apiRouter } from './routes/index.js';
import { ApiError } from './utils/ApiError.js';

const corsOptions = {
  // Requests without an Origin header come from native apps, curl and server-to-server calls.
  origin(origin, callback) {
    const allowed = !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin);
    callback(allowed ? null : ApiError.forbidden(`Origin ${origin} is not allowed`), allowed);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Generous enough for fast-forwarded NPC playback (one request per move) plus spectator polling.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new ApiError(429, 'Too many requests, slow down a little')),
});

export function createApp() {
  const app = express();

  // Vercel sits behind a proxy; trust it so rate limiting sees the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizeInput);
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  app.get('/', (_req, res) => res.json({ name: 'CONQUEST API', health: '/api/health' }));
  app.use('/api', apiLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
