import { connectDB } from '../database/connection.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export async function ensureDb(_req, _res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    logger.error(`Database unavailable: ${err.message}`);
    next(ApiError.serviceUnavailable('The database is unavailable. Please try again shortly.'));
  }
}
