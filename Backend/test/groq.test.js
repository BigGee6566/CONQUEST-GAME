// The Groq client against a mocked fetch: request shape, model fallback, rate limits and bad keys.
// No real network calls are made.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
  JWT_SECRET: 'unit-test-secret-that-is-long-enough-123',
  GROQ_API_KEY: 'gsk_test_key',
  GROQ_MODEL: 'openai/gpt-oss-20b',
  GROQ_FALLBACK_MODELS: 'openai/gpt-oss-120b',
  LOG_LEVEL: 'error',
});

const { complete, groqStatus, probeGroq, resetGroqClient, GROQ_URL } = await import('../src/services/groq.client.js');
const { narrateExchange } = await import('../src/services/commentary.service.js');

const realFetch = globalThis.fetch;
let calls = [];
let replies = [];

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const ok = (text) => json(200, { choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });

before(() => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = replies.shift();
    if (!next) throw new Error('unexpected extra Groq call');
    return next();
  };
});

after(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  calls = [];
  replies = [];
  resetGroqClient();
});

const battle = {
  attacker: { name: 'Warlord of Brazil', countryName: 'Brazil' },
  defender: { name: 'Guardian of Chile', countryName: 'Chile' },
};
const exchange = { attackerDice: [6, 3], defenderDice: [4, 3], attackerLosses: 0, defenderLosses: 1, attackerRemaining: 8, defenderRemaining: 1 };

describe('Groq client', () => {
  test('sends a well-formed chat completion and returns the reply', async () => {
    replies.push(() => ok('Brazil storms the Andes!'));
    const result = await complete({ system: 'sys', prompt: 'hello' });

    assert.deepEqual(result, { text: 'Brazil storms the Andes!', model: 'openai/gpt-oss-20b' });
    const [call] = calls;
    assert.equal(call.url, GROQ_URL);
    assert.equal(call.init.headers.Authorization, 'Bearer gsk_test_key');
    assert.equal(call.body.model, 'openai/gpt-oss-20b');
    assert.equal(call.body.reasoning_effort, 'low');
    assert.equal(call.body.include_reasoning, false);
    assert.ok(call.body.max_completion_tokens >= 400, 'leaves room for gpt-oss reasoning tokens');
    assert.equal('max_tokens' in call.body, false, 'uses max_completion_tokens, not the deprecated max_tokens');
    assert.deepEqual(call.body.messages.map((m) => m.role), ['system', 'user']);
    assert.equal(groqStatus().lastSuccess.model, 'openai/gpt-oss-20b');
  });

  test('falls back to the next model when one is retired, and remembers it', async () => {
    replies.push(() => json(400, { error: { code: 'model_decommissioned', message: 'The model has been decommissioned' } }));
    replies.push(() => ok('Fallback reporting in.'));
    assert.equal((await complete({ system: 's', prompt: 'p' })).model, 'openai/gpt-oss-120b');

    replies.push(() => ok('Straight to the fallback.'));
    await complete({ system: 's', prompt: 'p' });
    assert.deepEqual(calls.map((c) => c.body.model), ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'openai/gpt-oss-120b']);
    assert.deepEqual(groqStatus().disabledModels, ['openai/gpt-oss-20b']);
  });

  test('backs off after a rate limit instead of hammering Groq', async () => {
    replies.push(() => json(429, { error: { message: 'Rate limit reached' } }, { 'retry-after': '30' }));
    assert.equal(await complete({ system: 's', prompt: 'p' }), null);
    assert.equal(await complete({ system: 's', prompt: 'p' }), null);
    assert.equal(calls.length, 1, 'second call skipped during the cool-down');
    assert.ok(groqStatus().coolingDownUntil);
  });

  test('reports a rejected API key clearly', async () => {
    replies.push(() => json(401, { error: { message: 'Invalid API Key' } }));
    const probe = await probeGroq();
    assert.equal(probe.ok, false);
    assert.match(probe.error, /GROQ_API_KEY/);
  });

  test('treats an empty reply as a failure', async () => {
    replies.push(() => json(200, { choices: [{ message: { content: '' }, finish_reason: 'length' }] }));
    assert.equal(await complete({ system: 's', prompt: 'p' }), null);
    assert.match(groqStatus().lastError.message, /empty reply/);
  });
});

describe('battle commentary', () => {
  test('uses the LLM text when Groq answers', async () => {
    replies.push(() => ok('"Brazil hammers Chile; one defender left standing."'));
    const commentary = await narrateExchange({ battle, exchange, exchangeNumber: 1, outcome: null, soldiersGained: 0 });
    assert.deepEqual(commentary, { text: 'Brazil hammers Chile; one defender left standing.', source: 'llm' });
    assert.match(calls[0].body.messages[1].content, /Brazil rolled 6, 3; Chile rolled 4, 3/);
  });

  test('falls back to a template when Groq is unavailable', async () => {
    replies.push(() => { throw new Error('network down'); });
    const commentary = await narrateExchange({ battle, exchange, exchangeNumber: 1, outcome: null, soldiersGained: 0 });
    assert.equal(commentary.source, 'fallback');
    assert.ok(commentary.text.length > 0);
  });
});
