import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { GameRuleError } from '../engine/errors.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;

  // A move that breaks the game rules: tell the player exactly why.
  if (err instanceof GameRuleError) return new ApiError(422, err.message, { code: err.code });

  if (err instanceof ZodError) {
    return ApiError.badRequest(
      'Validation failed',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      'Validation failed',
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  // Optimistic concurrency: two requests tried to change the same game at once.
  if (err instanceof mongoose.Error.VersionError) {
    return ApiError.conflict('This game changed while you were acting. Refresh and try again.');
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    return ApiError.conflict(`That ${field} is already taken`);
  }

  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'Request body too large');

  return new ApiError(500, env.isProduction ? 'Something went wrong' : err?.message ?? 'Unknown error');
}

export function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);
  if (apiError.statusCode >= 500) logger.error(`${req.method} ${req.originalUrl} failed`, err);

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && { details: apiError.details }),
    },
  });
}
