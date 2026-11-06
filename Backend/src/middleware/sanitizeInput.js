// Removes MongoDB operator keys ($gt, $where, ...), dotted paths and prototype-polluting
// keys from client input before it can reach a query. Zod validation runs after this.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeKey(key) {
  return !key.startsWith('$') && !key.includes('.') && !FORBIDDEN_KEYS.has(key);
}

export function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => isSafeKey(key))
        .map(([key, nested]) => [key, sanitize(nested)]),
    );
  }
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.body) req.body = sanitize(req.body);
  // Express 5 exposes req.query through a getter, so replace it with a plain sanitised value.
  Object.defineProperty(req, 'query', {
    value: sanitize(req.query),
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
}
