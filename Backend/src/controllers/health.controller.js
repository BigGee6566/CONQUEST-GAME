import { connectDB, getDbStatus, pingDB } from '../database/connection.js';
import { groqStatus, probeGroq } from '../services/groq.client.js';
import { ApiError } from '../utils/ApiError.js';

const PROBE_CACHE_MS = 60_000;
let lastProbe = null;

// GET /api/health/ai            -> Groq configuration and the last success/error seen
// GET /api/health/ai?probe=true -> also makes a live Groq call (cached for a minute to protect the quota)
export async function getAiHealth(req, res) {
  if (req.query.probe !== 'true') {
    res.json({ groq: groqStatus() });
    return;
  }
  if (!lastProbe || Date.now() - lastProbe.at > PROBE_CACHE_MS) {
    lastProbe = { at: Date.now(), result: await probeGroq() };
  }
  res.status(lastProbe.result.ok ? 200 : 503).json({ groq: lastProbe.result, probedAt: new Date(lastProbe.at).toISOString() });
}

export function getHealth(_req, res) {
  res.json({
    status: 'ok',
    service: 'conquest-api',
    uptimeSeconds: Math.round(process.uptime()),
    database: getDbStatus(),
    timestamp: new Date().toISOString(),
  });
}

export async function getDatabaseHealth(_req, res) {
  const startedAt = Date.now();
  try {
    await connectDB({ retries: 0 });
    await pingDB();
  } catch (err) {
    throw ApiError.serviceUnavailable(`Database unreachable: ${err.message}`);
  }
  res.json({ status: 'ok', database: getDbStatus(), latencyMs: Date.now() - startedAt });
}
