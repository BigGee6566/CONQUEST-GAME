// End-to-end API test against a throwaway in-memory MongoDB replica set (so transactions run too).
// It never touches the real Atlas database or Groq: the variables below take precedence over .env.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;
let server;
let base;

async function call(method, path, { token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  // Generous launch timeout: mongod can take well over the default 10 s to start on slow disks.
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB_NAME: 'conquest_test',
    JWT_SECRET: 'integration-test-secret-that-is-long-enough',
    CORS_ORIGINS: '*',
    GROQ_API_KEY: '',
    LOG_LEVEL: 'error',
  });
  const { app } = await import('../src/app.js');
  const { connectDB } = await import('../src/database/connection.js');
  const { WorldCountry } = await import('../src/models/index.js');
  const { WORLD_COUNTRIES } = await import('../src/data/worldCountries.js');
  await connectDB();
  await WorldCountry.insertMany(WORLD_COUNTRIES);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  const { disconnectDB } = await import('../src/database/connection.js');
  await disconnectDB();
  await replSet?.stop();
});

describe('CONQUEST API', () => {
  const state = {};

  test('reports healthy, including a live database ping', async () => {
    assert.equal((await call('GET', '/health')).status, 200);
    const db = await call('GET', '/health/db');
    assert.equal(db.status, 200);
    assert.equal(db.body.database.state, 'connected');
  });

  test('validates registration input field by field', async () => {
    const { status, body } = await call('POST', '/auth/register', {
      body: { username: 'x', email: 'nope', password: 'short' },
    });
    assert.equal(status, 400);
    const paths = body.error.details.map((d) => d.path);
    assert.ok(paths.includes('username') && paths.includes('email') && paths.includes('password'));
  });

  test('registers, rejects duplicates case-insensitively, and never returns the password hash', async () => {
    const created = await call('POST', '/auth/register', {
      body: { username: 'Commander', email: 'commander@example.com', password: 'conquer123' },
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.token);
    assert.equal('passwordHash' in created.body.user, false);
    state.token = created.body.token;

    const duplicate = await call('POST', '/auth/register', {
      body: { username: 'commander', email: 'other@example.com', password: 'conquer123' },
    });
    assert.equal(duplicate.status, 409);

    const rival = await call('POST', '/auth/register', {
      body: { username: 'rival', email: 'rival@example.com', password: 'conquer123' },
    });
    state.rivalToken = rival.body.token;
  });

  test('logs in by username or email and rejects bad passwords', async () => {
    assert.equal((await call('POST', '/auth/login', { body: { identifier: 'COMMANDER', password: 'conquer123' } })).status, 200);
    assert.equal((await call('POST', '/auth/login', { body: { identifier: 'commander@example.com', password: 'conquer123' } })).status, 200);
    assert.equal((await call('POST', '/auth/login', { body: { identifier: 'commander', password: 'wrong-pass1' } })).status, 401);
  });

  test('blocks NoSQL operator injection in login', async () => {
    const { status } = await call('POST', '/auth/login', { body: { identifier: { $gt: '' }, password: { $gt: '' } } });
    assert.equal(status, 400);
  });

  test('protects /auth/me with the JWT', async () => {
    assert.equal((await call('GET', '/auth/me')).status, 401);
    assert.equal((await call('GET', '/auth/me', { token: 'not-a-jwt' })).status, 401);
    const me = await call('GET', '/auth/me', { token: state.token });
    assert.equal(me.body.user.username, 'Commander');
  });

  test('lists, searches, filters and sorts countries', async () => {
    const africa = await call('GET', '/countries?region=Africa&minSoldiers=5&sort=-soldierValue');
    assert.equal(africa.status, 200);
    assert.ok(africa.body.items.length > 0);
    assert.ok(africa.body.items.every((c) => c.region === 'Africa' && c.soldierValue >= 5));
    const values = africa.body.items.map((c) => c.soldierValue);
    assert.deepEqual(values, [...values].sort((a, b) => b - a));

    const search = await call('GET', '/countries?search=south');
    assert.ok(search.body.items.some((c) => c.code === 'ZA'));
    assert.equal((await call('GET', '/countries/za')).body.country.name, 'South Africa');
    assert.equal((await call('GET', '/countries?minSoldiers=7&maxSoldiers=2')).status, 400);
  });

  test('creates a game for the logged-in player only', async () => {
    assert.equal((await call('POST', '/games', { body: { homeCountry: 'ZA' } })).status, 401);
    const { status, body } = await call('POST', '/games', { token: state.token, body: { homeCountry: 'ZA' } });
    assert.equal(status, 201);
    assert.equal(body.game.countries.length, 10);
    assert.equal(body.game.players.filter((p) => p.isNPC).length, 9);
    assert.equal(body.game.viewer.isOwner, true);
    state.gameId = body.game.id;
  });

  test('lets anyone watch a public game but only the owner play it', async () => {
    const spectator = await call('GET', `/games/${state.gameId}`);
    assert.equal(spectator.status, 200);
    assert.equal(spectator.body.game.viewer.isSpectator, true);
    assert.equal(spectator.body.game.viewer.canAct, false);

    assert.equal((await call('POST', `/games/${state.gameId}/actions`, { body: { type: 'endTurn' } })).status, 401);
    assert.equal(
      (await call('POST', `/games/${state.gameId}/actions`, { token: state.rivalToken, body: { type: 'endTurn' } })).status,
      403,
    );
    assert.equal((await call('POST', `/games/${state.gameId}/actions`, { token: state.token, body: { type: 'nuke' } })).status, 400);
    assert.equal((await call('GET', '/games/not-an-id')).status, 400);
  });

  test('plays NPC and human turns through the API until a few rounds have passed', async () => {
    let game = (await call('GET', `/games/${state.gameId}`, { token: state.token })).body.game;
    let humanMoves = 0;
    for (let request = 0; request < 250 && game.status === 'active' && game.round < 4; request += 1) {
      const human = game.players.find((p) => !p.isNPC);
      let response;
      if (game.currentPlayerId !== human.id) {
        response = await call('POST', `/games/${state.gameId}/npc-step`, { token: state.token, body: { fastForward: true } });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.ok(response.body.decision?.reasoning, 'NPC moves must carry a justification');
      } else {
        const mine = game.countries.filter((c) => c.ownerId === human.id).sort((a, b) => b.soldiers - a.soldiers);
        const enemy = game.countries.filter((c) => c.ownerId !== human.id).sort((a, b) => a.soldiers - b.soldiers)[0];
        let action;
        if (game.phase === 'reinforce') action = { type: 'reinforce', allocation: [{ country: mine[0].code, soldiers: game.pendingReinforcements }] };
        else if (game.phase === 'attacking') action = { type: 'roll' };
        else if (!game.hasAttackedThisTurn && mine[0].soldiers >= 2) action = { type: 'attack', from: mine[0].code, to: enemy.code };
        else action = { type: 'endTurn' };

        if (action.type === 'attack' && humanMoves === 0) {
          const own = await call('POST', `/games/${state.gameId}/actions`, { token: state.token, body: { type: 'attack', from: mine[0].code, to: mine[0].code } });
          assert.equal(own.status, 422);
          assert.equal(own.body.error.code, 'OWN_COUNTRY');
        }
        response = await call('POST', `/games/${state.gameId}/actions`, { token: state.token, body: action });
        humanMoves += 1;
      }
      assert.equal(response.status, 200, JSON.stringify(response.body));
      game = response.body.game;
    }
    assert.ok(humanMoves > 0 || game.status !== 'active');
    state.finalGame = game;
  });

  test('keeps a gap-free event log that spectators can poll incrementally', async () => {
    // Page through the whole log the way a client does: keep asking for events after the last seq.
    const items = [];
    let latestSeq = 0;
    for (let after = 0; ; after = items.at(-1).seq) {
      const page = await call('GET', `/games/${state.gameId}/events?after=${after}&limit=200`);
      latestSeq = page.body.latestSeq;
      items.push(...page.body.items);
      if (page.body.items.length < 200) break;
    }
    const seqs = items.map((e) => e.seq);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1));
    assert.equal(latestSeq, state.finalGame.eventSeq);
    assert.equal(seqs.length, latestSeq);
    assert.ok(items.some((e) => e.type === 'npc_decision' && e.reasoning));

    const tail = await call('GET', `/games/${state.gameId}/events?tail=5`);
    assert.deepEqual(tail.body.items.map((e) => e.seq), seqs.slice(-5));
    const since = await call('GET', `/games/${state.gameId}/events?after=${seqs.at(-3)}`);
    assert.deepEqual(since.body.items.map((e) => e.seq), seqs.slice(-2));
  });

  test('stores battles with dice and commentary for replay', async () => {
    const list = await call('GET', `/games/${state.gameId}/battles`);
    assert.equal(list.status, 200);
    assert.ok(list.body.items.length > 0);
    const { body } = await call('GET', `/games/${state.gameId}/battles/${list.body.items.at(-1).id}`);
    const [exchange] = body.battle.exchanges;
    assert.equal(exchange.attackerDice.length, exchange.defenderDice.length);
    assert.ok(exchange.commentary.text.length > 0);
    assert.equal(exchange.commentary.source, 'fallback');
  });

  test('lists my games and public games with filters', async () => {
    const mine = await call('GET', '/games?scope=mine', { token: state.token });
    assert.equal(mine.body.items.length, 1);
    assert.equal((await call('GET', '/games?scope=mine')).status, 401);
    const searched = await call('GET', '/games?search=commander');
    assert.ok(searched.body.items.some((g) => g.id === state.gameId));
    const none = await call('GET', '/games?status=abandoned');
    assert.equal(none.body.items.length, 0);
  });

  test('hides private games from everyone but their owner', async () => {
    const { body } = await call('POST', '/games', { token: state.rivalToken, body: { homeCountry: 'IN', visibility: 'private' } });
    assert.equal((await call('GET', `/games/${body.game.id}`)).status, 404);
    assert.equal((await call('GET', `/games/${body.game.id}`, { token: state.token })).status, 404);
    assert.equal((await call('GET', `/games/${body.game.id}`, { token: state.rivalToken })).status, 200);
  });

  test('abandoning ends the game and records the loss', async () => {
    if (state.finalGame.status === 'active') {
      const abandoned = await call('POST', `/games/${state.gameId}/abandon`, { token: state.token });
      assert.equal(abandoned.body.game.status, 'abandoned');
      assert.equal((await call('POST', `/games/${state.gameId}/actions`, { token: state.token, body: { type: 'endTurn' } })).status, 409);
    }
    const stats = await call('GET', '/stats/me', { token: state.token });
    assert.equal(stats.status, 200);
    assert.equal(stats.body.profile.stats.gamesPlayed, 1);
    assert.equal(stats.body.profile.stats.gamesLost + stats.body.profile.stats.gamesWon, 1);
  });

  test('serves the leaderboard and platform analytics publicly', async () => {
    const board = await call('GET', '/stats/leaderboard');
    assert.ok(board.body.items.some((u) => u.username === 'Commander'));
    const platform = await call('GET', '/stats/platform');
    assert.equal(platform.body.users, 2);
    assert.equal(platform.body.games, 2);
    assert.ok(platform.body.popularStartingCountries.some((c) => c.code === 'ZA' && c.name === 'South Africa'));
  });
});
