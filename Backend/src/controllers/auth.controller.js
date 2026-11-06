import * as authService from '../services/auth.service.js';

export async function register(req, res) {
  const { user, token } = await authService.register(req.validated.body);
  res.status(201).json({ user: user.toJSON(), token });
}

export async function login(req, res) {
  const { user, token } = await authService.login(req.validated.body);
  res.json({ user: user.toJSON(), token });
}

export function me(req, res) {
  res.json({ user: req.user.toJSON() });
}
