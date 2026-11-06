# CONQUEST: Geopolitics War Game

A single-player, turn-based strategy game (UCT INF4001N Entrance Exam 2027 case study). You pick a real country; nine AI commanders with distinct personalities hold nine more. Battles are fought with dice, every NPC decision is explained, and an LLM war correspondent narrates each roll. Conquer all ten nations to win.

| Part | Tech |
|---|---|
| Frontend (`Frontend/`) | Expo SDK 58, React Native 0.88, TypeScript, React Navigation 7, axios. Runs on web, Android and iOS |
| Backend (`Backend/`) | Node.js 20+, Express 5, Mongoose 9, Zod 4, JWT, bcrypt |
| Database | MongoDB Atlas (NoSQL) |
| AI | Groq API (`openai/gpt-oss-20b`, falling back to `openai/gpt-oss-120b`) for battle commentary; Monte Carlo AI for NPC strategy |
| Hosting | Vercel (backend as a serverless function, frontend as a static web export) |

---

## 1. Features, mapped to the marksheet

| Marksheet criterion | Where to look |
|---|---|
| **Database layer** (separate, configured, online) | `Backend/src/database/` (connection + transactions), `Backend/src/config/env.js` (validated config), `Backend/src/models/` |
| **Connection to database** | Cached connection reused across Vercel invocations, retry with backoff, connection events logged, `/api/health/db` live ping |
| **Design of the database** | 5 collections with embedded vs referenced data chosen deliberately (section 4) |
| **Coding structure / MVC** | `routes -> controllers -> services -> models`, plus a pure domain layer in `src/engine/` |
| **OO concepts** | `Game`, `Player`, `Country`, `Dice`, `BattleEngine`, `GameFactory`, `NpcStrategy`, `NpcController`, `ActionResult`: private `#fields`, getters, invariants enforced inside the classes |
| **Validation, controls & security** | Zod on every route, Mongoose schema validators, operator-key sanitising, rate limiting, helmet, CORS allow-list, optimistic concurrency |
| **Functionality: lists, search, filter, view** | Country picker (search, region, strength, sort), game lists (mine/public, status filter, search, pagination), war-log filters, battle history |
| **User interface / navigation** | Dark "war room" theme, responsive (two-column desktop, stacked phone), tab bar + stack navigation, real URLs on web |
| **Security: authentication & authorisation** | JWT login/register, bcrypt hashing, only the owner can play a game, spectators read-only, private games hidden |
| **Sophistication** | Rule-complete game engine, transactional persistence, spectator live view, serverless-safe NPC playback |
| **AI application** | LLM commentary for every dice exchange (with graceful fallback) + NPC AI that estimates odds and justifies every move |

**Branding and design:** an original CONQUEST logo (war shield, globe with a planted flag, crossed swords, ten stars for the ten nations). Vector sources are in `Frontend/assets/brand/` (`logo.svg`, `logo-mark.svg`, `app-icon.svg`), with PNG renders used for the app icon, Android adaptive icons, favicon, native splash, the animated in-app splash, loading screens and the home screen. The UI uses a dark "war room" style: navy gradient backdrop with a tactical grid, the Russo One display font, gold gradient buttons, glass panels and owner-coloured country tiles.

**Bonus feature:** NPC profiles (Aggressive, Defensive, Balanced, Opportunist; bonus idea #9). Also included: battle replay & game history (#5), player and platform analytics (#3), real-time spectating via shared URL (#10), dice animations (#4) and anti-cheat controls (#8: server-side rules, secure RNG, optimistic locking).

---

## 2. How the game works

* **Setup:** choose any of 120+ countries; 9 rivals are drawn at random; turn order is shuffled. Soldiers come from population (Worldometers 2025): up to 5M = 1 soldier, up to 10M = 2, ..., over 150M = 9.
* **Each turn:** from round 2 you receive **2 soldiers per country you hold** and must place them. Then you may **attack once**, **transfer** soldiers between your countries (each keeps at least 1), and **end/skip** your turn.
* **Battle:** the attacker fights with `soldiers - 1`; each side rolls `min(attacker - 1, defender)` dice, paired highest vs highest. Higher die wins the pair; **ties kill nobody**. Keep rolling until the defender is wiped out (**conquest**), the attacker is down to 1 (**repelled**), or you **retreat** (which ends your turn).
* **Conquest reward:** `Max(2, floor(conquered country's soldier value / 2))` soldiers garrison the new country (India 9 -> 4, Vatican City 1 -> 2). You can then move extra troops in.
* **End:** a player with no countries is eliminated and skipped. Own all 10 countries to win. If you are eliminated, the game ends in defeat.
* **NPC turns** play out one visible move at a time. **Fast-forward** speeds them up but still shows every move and every justification.
* **Spectating:** every public game has a shareable URL (`/game/<id>`). Anyone can watch live; only the logged-in owner can play.

Interpretation notes: dice are paired highest-vs-highest (the brief's worked example gives the same result); reinforcements must be placed before acting; NPCs relax their required odds slightly each round so cautious AIs cannot stall the game forever.

---

## 3. Architecture

```
Frontend (Expo / React Native Web)            Backend (Express on Vercel)                     MongoDB Atlas
 screens -> hooks (useGameSession,  --HTTPS--> routes -> validate (Zod) -> auth (JWT)    --->  users
            useMovePlanner)          JSON+JWT       -> controllers -> services                 worldcountries
         -> api/ (axios client)                        |-> engine/ (pure OO game rules + AI)   games  (players + countries embedded)
                                                       |-> commentary.service --> Groq LLM     battles (referenced by game)
                                                       |-> database/ (cached conn, txns)       gameevents (referenced by game)
```

* `Backend/src/engine/` has no database or HTTP code. `GameMapper` converts between Mongo documents and the domain `Game`, so rules are unit-tested in isolation.
* Every move is: load game -> rebuild domain `Game` -> apply the move (validated by the engine) -> generate AI commentary -> save game, battle and events **in one MongoDB transaction**. Game saves use optimistic concurrency, so double-clicks or two tabs cannot apply the same move twice.
* Vercel functions are stateless, so all state lives in MongoDB. NPC turns are driven by the client calling `POST /api/games/:id/npc-step` once per move.

```
Backend/
  api/index.js            Vercel entry point (exports the Express app)
  src/app.js, server.js   Express app / local dev server
  src/config/             env validation (Zod), game rules and constants
  src/database/           connection (cached, retrying), transactions
  src/models/             User, WorldCountry, Game, Battle, GameEvent
  src/engine/             Dice, Country, Player, BattleEngine, Game, GameFactory, GameMapper, ai/*
  src/services/           auth, country, game, stats, commentary, groq.client (Groq API), view serializers
  src/controllers/, src/routes/, src/middleware/, src/validators/
  scripts/seed-countries.js
  test/                   74 tests: models, engine, full simulated games, API end-to-end
Frontend/
  App.tsx, src/navigation/   stack + tabs + web deep links
  src/screens/               Auth, Lobby, Explore, NewGame, Game, Profile
  src/components/            Board tiles, animated dice, battle panel, war log, replay modal, ...
  src/hooks/                 useGameSession (playback, polling), useMovePlanner, useDebounced
  src/api/                   axios client + typed endpoints
```

---

## 4. Database design

| Collection | Purpose | Notable design choices |
|---|---|---|
| `users` | Accounts and lifetime stats | `passwordHash` is `select: false` and never serialised; case-insensitive unique username (collation index); unique email |
| `worldcountries` | Reference catalogue of 121 countries | Soldier value derived from population on validation; indexed by code, name, region |
| `games` | One campaign | **Embeds** its 10 players and 10 countries: always read and written together, bounded in size, and a turn must update them atomically. Countries reference the owning player by subdocument id. Optimistic concurrency (`__v`). |
| `battles` | Every attack with every dice exchange and its commentary | **Referenced** from the game (`game` field): unbounded growth would push the game document toward the 16 MB limit. Powers replays. |
| `gameevents` | Append-only activity feed (NPC decisions + reasons, transfers, conquests...) | Unique `(game, seq)` index; spectators poll `?after=<seq>` for live updates |

---

## 5. Run locally

Prerequisites: **Node.js 20+** and a **MongoDB Atlas** cluster (the free M0 tier is enough). A local `mongod` also works, but only an Atlas replica set supports transactions; without one the app saves without transactions and logs a warning.

### Backend

```bash
cd Backend
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Edit `Backend/.env`:

| Variable | Value |
|---|---|
| `MONGODB_URI` | Atlas connection string (Atlas -> Database -> Connect -> Drivers) |
| `JWT_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GROQ_API_KEY` | Free key from https://console.groq.com/keys (template commentary is used without it) |
| `GROQ_MODEL`, `GROQ_FALLBACK_MODELS` | Defaults `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. Groq retired the Llama 3.x chat models for free accounts on 16 Aug 2026, so do not use them. |
| `CORS_ORIGINS` | `http://localhost:8081` for local Expo web (comma-separate several) |
| `DEMO_USERNAME`, `DEMO_EMAIL`, `DEMO_PASSWORD` | Optional examiner account created by the seed script |

```bash
npm run seed         # loads 121 countries, builds indexes, creates the demo account
npm run check:groq   # one real Groq call: prints the model, latency and a sample line
npm run dev          # http://localhost:4000  (check /api/health/db and /api/health/ai?probe=true)
```

Groq diagnostics: `GET /api/health/ai` shows whether a key is configured, which models are in use and the last success or error; `GET /api/health/ai?probe=true` makes a live call (cached for one minute). On startup the server logs either `Groq commentary enabled (...)` or a warning that the key is missing.

### Frontend

```bash
cd Frontend
npm install
copy .env.example .env        # set EXPO_PUBLIC_API_URL=http://localhost:4000
npm run web                   # opens http://localhost:8081
```

For a phone, run `npx expo start` and scan the QR code with Expo Go. Set `EXPO_PUBLIC_API_URL` to your PC's LAN IP (for example `http://192.168.1.20:4000`), or `http://10.0.2.2:4000` on the Android emulator, and add that origin to `CORS_ORIGINS` if you use the web build.

### Tests

```bash
cd Backend
npm run test:unit   # models, engine rules, NPC AI, 6 full simulated games (fast, no database)
npm run test:api    # end-to-end API against an in-memory MongoDB replica set
npm test            # everything (74 tests)
```

`test:api` downloads a MongoDB test binary (~70 MB) the first time. It never touches Atlas or Groq.

---

## 6. Deploy to Vercel

This is two Vercel projects from one GitHub repository: `Backend` and `Frontend`. Do the steps in order, because each one needs a URL from the one before.

### 6.1 Push to your GitHub
Create an empty repository on GitHub, without a README or .gitignore, then run this from the `CONQUEST` folder:

```bash
git init -b main
git add .
git status --short
git commit -m "CONQUEST source"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Before committing, check the `git status` list. It should have about 135 files, with no `.env`, `node_modules` or `.claude`. The root `.gitignore` handles this.

### 6.2 MongoDB Atlas
1. Create a free M0 cluster at https://cloud.mongodb.com.
2. **Database Access:** add a database user (read/write) for the app.
3. **Network Access:** add `0.0.0.0/0`. Vercel functions use changing IP addresses.
4. Copy the connection string, put your password in it, and keep it for `MONGODB_URI`. If the password has symbols such as `@` or `/`, URL-encode them or choose a letters-and-numbers password.

### 6.3 Backend project
1. In Vercel choose **Add New -> Project** and import the repository.
2. **Root Directory:** `Backend`. Leave the build settings empty. `vercel.json` sets the framework to Other and routes every request to `api/index.js`.
3. **Environment variables:**

| Name | Value |
|---|---|
| `MONGODB_URI` | Your Atlas connection string |
| `MONGODB_DB_NAME` | `conquest` |
| `JWT_SECRET` | 32+ random characters. Generate a new one for production |
| `JWT_EXPIRES_IN` | `7d` |
| `GROQ_API_KEY` | Your Groq key |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `GROQ_FALLBACK_MODELS` | `openai/gpt-oss-120b` |
| `CORS_ORIGINS` | Leave this out for now. You set it in step 6.5 |

4. Deploy, then copy the short production URL, such as `https://<backend>.vercel.app`.
5. Check `https://<backend>.vercel.app/api/health/db` shows `"status":"ok"`, and `https://<backend>.vercel.app/api/health/ai?probe=true` shows `"ok": true`.

The country list loads into an empty database automatically on first use.

### 6.4 Frontend project
1. In Vercel, import the same repository again as a second project. **Root Directory:** `Frontend`.
2. `Frontend/vercel.json` already sets the framework, the build command (`npx expo export --platform web`), the output directory (`dist`) and the rewrite that makes `/game/<id>` links work.
3. **Environment variables:** `EXPO_PUBLIC_API_URL=https://<backend>.vercel.app` and `EXPO_PUBLIC_WEB_URL=https://<frontend>.vercel.app`. Use no trailing slash and no `/api`. You won't know the frontend URL until the first deploy, so add `EXPO_PUBLIC_WEB_URL` afterwards and redeploy.
4. Deploy, then copy the short production URL.

`EXPO_PUBLIC_*` values are baked in at build time, so redeploy the frontend whenever you change them.

### 6.5 Connect them
1. In the **backend** project, add `CORS_ORIGINS=https://<frontend>.vercel.app`. It must match the browser address exactly: `https`, no trailing slash. Add several by separating them with commas.
2. **Redeploy the backend.** Environment variable changes only apply to new deployments.

### 6.6 Create the examiner account
Point `MONGODB_URI` in your local `Backend/.env` at the same Atlas cluster, set `DEMO_USERNAME`, `DEMO_EMAIL` and `DEMO_PASSWORD`, then run this from `Backend`:

```bash
npm run seed
```

### 6.7 Final check
Open the frontend's short production URL in a private window, not a long deployment-specific URL, and check that you can:

1. Register a new account and log in with the examiner account.
2. Start a campaign, attack, and see dice and commentary marked "AI live".
3. Refresh the page on `/game/<id>` and land on the same game.
4. Open that game link in another private window and watch without logging in.

### 6.8 If something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| Backend URL shows `FUNCTION_INVOCATION_FAILED` | `MONGODB_URI` or `JWT_SECRET` is missing or invalid. The function logs name the variable | Fix it in Vercel and redeploy |
| `/api/health/db` fails, or the app says the database is unavailable | Atlas Network Access, or a wrong password in `MONGODB_URI` | Allow `0.0.0.0/0` and recheck the connection string |
| Login shows a network error, and the browser console mentions CORS | `CORS_ORIGINS` doesn't match the frontend address exactly | Correct it and redeploy the backend |
| Browser console shows requests to `localhost:4000` | `EXPO_PUBLIC_API_URL` was missing when the frontend was built | Set it and redeploy the frontend |
| Commentary says "Dispatch" instead of "AI live" | Groq key missing, or the free rate limit was hit. The game still works | Check `/api/health/ai?probe=true` |

---

## 7. Submission checklist (INF4001 Amathuba)

1. **Zipped source code:** do not zip the folder by hand, because that picks up `node_modules/`, `.claude/` and your `.env` files. After committing (section 6.1), build the zip from git instead, which includes only committed files:

   ```bash
   git archive -o ../CONQUEST-source.zip HEAD
   ```
2. **Database access:** in Atlas, open **Project -> Access Manager -> Invite to Project** and invite `ammarcanani@gmail.com`, `mc.tanner@uct.ac.za` and `ridewaan.hanslo@uct.ac.za` with the **Project Read Only** role. Alternatively, create a read-only database user and submit its username and password.
3. **Deployed URL:** the frontend Vercel URL (plus the backend URL for reference).
4. **App credentials:** set `DEMO_USERNAME` / `DEMO_EMAIL` / `DEMO_PASSWORD`, run `npm run seed` against Atlas, and submit that username and password. Any examiner can also register a new account.
5. **Read me:** this file.

---

## 8. API reference (`/api`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health`, `/health/db` | - | Service and live database health |
| GET | `/health/ai`, `/health/ai?probe=true` | - | Groq status / live Groq call |
| POST | `/auth/register`, `/auth/login` | - | Returns `{ user, token }` (rate limited) |
| GET | `/auth/me` | JWT | Current user |
| GET | `/countries?search=&region=&minSoldiers=&maxSoldiers=&sort=` | - | Country catalogue |
| GET | `/games?scope=mine\|public&status=&search=&page=` | optional | Game lists |
| POST | `/games` `{ homeCountry, title?, visibility }` | JWT | Start a campaign |
| GET | `/games/:id` | optional | Board state (spectators allowed for public games) |
| GET | `/games/:id/events?after=&tail=` | optional | Activity feed / live polling |
| GET | `/games/:id/battles`, `/games/:id/battles/:battleId` | optional | Battle history and replay |
| POST | `/games/:id/actions` `{ type: reinforce\|transfer\|attack\|roll\|stop\|endTurn, ... }` | owner | Human move |
| POST | `/games/:id/npc-step` `{ fastForward }` | owner | Play one NPC move |
| POST | `/games/:id/abandon` | owner | Forfeit |
| GET | `/stats/me`, `/stats/leaderboard`, `/stats/platform` | JWT / - / - | Analytics |

Errors always look like `{ "error": { "code", "message", "details?" } }`: 400 validation, 401 unauthenticated, 403 not your game, 404, 409 conflicting move, 422 rule violation, 429 rate limited.

---

## 9. Known limitations

* Groq's free tier limits requests per minute. When the limit is hit, commentary falls back to built-in templates for a short cool-down (shown as "Dispatch" instead of "AI live"). During fast-forward only the deciding roll of each battle is sent to the LLM.
* NPC turns only advance while the owner has the game open, because nothing runs in the background on serverless hosting. Spectators see moves as the owner plays.
* Flag images load from `flagcdn.com`; offline, the country code is shown instead.
