import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const OPTIONS = Object.freeze({ issuer: 'conquest-api', audience: 'conquest-app' });

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), username: user.username, role: user.role },
    env.JWT_SECRET,
    { ...OPTIONS, expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { ...OPTIONS, algorithms: ['HS256'] });
}
