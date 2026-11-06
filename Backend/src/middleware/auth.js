import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';

function extractToken(req) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

async function resolveUser(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  return user;
}

// Requires a valid JWT and loads the user onto req.user.
export async function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Log in to do that');
  req.user = await resolveUser(token);
  next();
}

// Spectator-friendly routes: attach the user when a valid token is sent, otherwise continue anonymously.
export async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  req.user = null;
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      req.user = null;
    }
  }
  next();
}
