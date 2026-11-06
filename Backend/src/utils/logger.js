const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const threshold =
  LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

const sinks = { error: console.error, warn: console.warn, info: console.log, debug: console.log };

function log(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (meta === undefined) sinks[level](line);
  else sinks[level](line, meta);
}

export const logger = Object.freeze({
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
});
