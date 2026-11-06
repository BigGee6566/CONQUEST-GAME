import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

// Slows down password guessing and mass sign-ups.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new ApiError(429, 'Too many attempts. Try again in a few minutes.')),
});

export const authRouter = Router();

authRouter.post('/register', credentialLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', credentialLimiter, validate({ body: loginSchema }), login);
authRouter.get('/me', authenticate, me);
