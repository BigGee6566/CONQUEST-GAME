import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';

// Compared against when the account does not exist, so a failed login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('conquest-timing-guard', 10);

export async function register({ username, email, password }) {
  const user = new User({ username, email });
  await user.setPassword(password);
  await user.save();
  return { user, token: signToken(user) };
}

export async function login({ identifier, password }) {
  const user = await User.findByLogin(identifier);
  const valid = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);
  if (!valid) throw ApiError.unauthorized('Invalid username/email or password');

  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: signToken(user) };
}
