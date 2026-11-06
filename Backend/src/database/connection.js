import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

const CONNECT_OPTIONS = Object.freeze({
  dbName: env.MONGODB_DB_NAME,
  appName: 'conquest-api',
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 8_000,
  socketTimeoutMS: 45_000,
  // Fail fast instead of queueing queries while disconnected; every request awaits connectDB() first.
  bufferCommands: false,
});

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// Vercel reuses warm function instances, so the connection promise lives on globalThis
// to be shared across invocations instead of opening a new pool per request.
const cache = (globalThis.__conquestMongo ??= { promise: null, listenersAttached: false, usingFallbackDns: false });

function attachListeners() {
  if (cache.listenersAttached) return;
  cache.listenersAttached = true;
  const { connection } = mongoose;
  connection.on('connected', () => logger.info(`MongoDB connected to ${connection.host}/${connection.name}`));
  connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));
}

// mongodb+srv:// URIs need a DNS SRV lookup. Some home/campus routers refuse or time out on SRV
// queries ("querySrv ECONNREFUSED"); ENOTFOUND, by contrast, means the cluster name is wrong.
const DNS_SERVER_FAILURE = /^(ECONNREFUSED|ETIMEOUT|ESERVFAIL|EREFUSED|ECONNRESET)$/;
const SRV_LOOKUP_FAILURE = /query(Srv|Txt) (ECONNREFUSED|ETIMEOUT|ESERVFAIL|EREFUSED|ECONNRESET)/;

function useFallbackDns(reason) {
  if (cache.usingFallbackDns) return false;
  cache.usingFallbackDns = true;
  logger.warn(`Local DNS failed the Atlas lookup (${reason}); switching to public DNS ${env.dnsFallbackServers.join(', ')}`);
  dns.setServers(env.dnsFallbackServers);
  return true;
}

async function ensureSrvResolvable() {
  if (!env.MONGODB_URI.startsWith('mongodb+srv://') || cache.usingFallbackDns) return;
  const host = new URL(env.MONGODB_URI).hostname;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    if (DNS_SERVER_FAILURE.test(err.code ?? '')) useFallbackDns(err.code);
  }
}

async function connectWithRetry(retries) {
  await ensureSrvResolvable();
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await mongoose.connect(env.MONGODB_URI, CONNECT_OPTIONS);
    } catch (err) {
      // The local DNS server answered the probe but failed the driver's own lookup: switch and retry now.
      if (SRV_LOOKUP_FAILURE.test(err.message) && useFallbackDns(err.message.split(' ')[1])) continue;
      if (attempt >= retries) throw err;
      const delayMs = 500 * 2 ** attempt;
      logger.warn(`MongoDB connection attempt ${attempt + 1} failed (${err.message}); retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function connectDB({ retries = 2 } = {}) {
  const { readyState } = mongoose.connection;
  if (readyState === 1) return mongoose.connection;
  // A previous connection was closed (not merely reconnecting), so start a fresh one.
  if (readyState === 0) cache.promise = null;

  if (!cache.promise) {
    attachListeners();
    cache.promise = connectWithRetry(retries).catch((err) => {
      cache.promise = null;
      throw err;
    });
  }

  await cache.promise;
  return mongoose.connection;
}

export async function disconnectDB() {
  cache.promise = null;
  await mongoose.disconnect();
}

export async function pingDB() {
  await mongoose.connection.db.admin().command({ ping: 1 });
}

export function getDbStatus() {
  const { connection } = mongoose;
  return {
    state: READY_STATES[connection.readyState] ?? 'unknown',
    database: connection.name ?? env.MONGODB_DB_NAME,
    host: connection.host ?? null,
  };
}
