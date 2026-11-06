// Local development entry point. On Vercel, api/index.js is used instead and no port is opened.
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './database/connection.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`CONQUEST API listening on http://localhost:${env.PORT}`);
    if (env.hasGroq) logger.info(`Groq commentary enabled (${[env.GROQ_MODEL, ...env.groqFallbackModels].join(' -> ')})`);
    else logger.warn('GROQ_API_KEY is not set: battle commentary will use built-in templates');
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
