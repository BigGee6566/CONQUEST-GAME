import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Groq's OpenAI-compatible Chat Completions API (https://console.groq.com/docs/api-reference).
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TIMEOUT_MS = 8_000;
// gpt-oss models "think" before answering and those tokens share this budget,
// so it must be well above the ~60 words of commentary we actually want.
const MAX_COMPLETION_TOKENS = 700;
const INVALID_KEY_COOLDOWN_MS = 10 * 60_000;

// Models that accept reasoning_effort / include_reasoning; others reject them with a 400.
const REASONING_MODEL = /^(openai\/gpt-oss|qwen\/)/;

const state = {
  disabledModels: new Set(),
  coolDownUntil: 0,
  lastError: null,
  lastSuccess: null,
};

export function configuredModels() {
  return [...new Set([env.GROQ_MODEL, ...env.groqFallbackModels])];
}

function availableModels() {
  return configuredModels().filter((model) => !state.disabledModels.has(model));
}

function fail(message, level = 'warn') {
  state.lastError = { message, at: new Date().toISOString() };
  logger[level](`Groq: ${message}`);
}

function requestBody(model, system, prompt) {
  return {
    model,
    temperature: 0.9,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    ...(REASONING_MODEL.test(model) && { reasoning_effort: 'low', include_reasoning: false }),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
}

async function errorDetails(response) {
  try {
    const body = await response.json();
    return { code: body?.error?.code ?? body?.error?.type ?? null, message: body?.error?.message ?? '' };
  } catch {
    return { code: null, message: '' };
  }
}

// Sends one chat completion, trying each configured model in turn when one is missing or retired.
// Resolves to { text, model } or null; never throws, so callers can always fall back.
export async function complete({ system, prompt }) {
  if (!env.hasGroq) return null;
  if (Date.now() < state.coolDownUntil) return null;

  for (const model of availableModels()) {
    let response;
    try {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(model, system, prompt)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      fail(`request to ${model} failed: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`);
      return null;
    }

    if (response.ok) {
      const body = await response.json();
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) {
        fail(`${model} returned an empty reply (finish_reason: ${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
        return null;
      }
      state.lastSuccess = { model, at: new Date().toISOString() };
      state.lastError = null;
      return { text, model };
    }

    const { code, message } = await errorDetails(response);

    if (response.status === 401 || response.status === 403) {
      state.coolDownUntil = Date.now() + INVALID_KEY_COOLDOWN_MS;
      fail(`API key rejected (HTTP ${response.status}). Check GROQ_API_KEY.`, 'error');
      return null;
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 20;
      state.coolDownUntil = Date.now() + retryAfter * 1000;
      fail(`rate limited; using template commentary for ${retryAfter}s`);
      return null;
    }
    // A retired or unknown model: stop using it and try the next one.
    if (response.status === 404 || /model/i.test(`${code ?? ''} ${message}`)) {
      state.disabledModels.add(model);
      fail(`model ${model} unavailable (HTTP ${response.status} ${code ?? ''} ${message}). Trying the next model.`);
      continue;
    }
    fail(`${model} returned HTTP ${response.status} ${message}`);
    return null;
  }

  if (availableModels().length === 0) fail('none of the configured Groq models are available. Update GROQ_MODEL.', 'error');
  return null;
}

export function groqStatus() {
  return {
    configured: env.hasGroq,
    models: configuredModels(),
    disabledModels: [...state.disabledModels],
    coolingDownUntil: state.coolDownUntil > Date.now() ? new Date(state.coolDownUntil).toISOString() : null,
    lastSuccess: state.lastSuccess,
    lastError: state.lastError,
  };
}

// Live end-to-end check used by `npm run check:groq` and GET /api/health/ai?probe=true.
export async function probeGroq() {
  if (!env.hasGroq) return { ok: false, error: 'GROQ_API_KEY is not set', status: groqStatus() };
  const startedAt = Date.now();
  const result = await complete({
    system: 'You are a terse war correspondent.',
    prompt: 'In one short sentence, announce that the CONQUEST war room is online.',
  });
  return result
    ? { ok: true, model: result.model, latencyMs: Date.now() - startedAt, sample: result.text, status: groqStatus() }
    : { ok: false, error: state.lastError?.message ?? 'unknown error', status: groqStatus() };
}

// Test helper: clears cooldowns and disabled models between scenarios.
export function resetGroqClient() {
  state.disabledModels.clear();
  state.coolDownUntil = 0;
  state.lastError = null;
  state.lastSuccess = null;
}
