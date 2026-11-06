# CONQUEST: Game Description

This file describes the game as it is built today: the rules, nations, screens, layout, user workflow and features. Use it as the starting point for improvements. Section 12 lists gaps found while reading the code, and section 13 is yours to fill in.

`README.md` covers setup, deployment, the database and the API. This file covers what the player sees and does.

Everything here comes from the code in `Backend/src` and `Frontend/src`, read on 5 November 2026. Layouts come from the component code, not from a fresh play-through.

---

## 1. The game at a glance

| | |
|---|---|
| **What it is** | Single-player, turn-based geopolitical war game with dice battles |
| **Players** | 1 human and 9 AI commanders (NPCs) |
| **Board** | 10 real countries: yours plus 9 drawn at random from a catalogue of 121 |
| **Goal** | Own all 10 countries. If you lose your last country, the game ends in defeat |
| **Platforms** | Web, Android and iOS, from one Expo / React Native codebase |
| **Accounts** | Needed to play. Not needed to watch a public game |
| **AI** | Monte Carlo odds drive NPC decisions; Groq LLM writes the battle commentary |
| **Style** | Dark "war room": navy backdrop, tactical grid, gold accents, Russo One display font |

---

## 2. Rules

### Setup
1. You choose a home country.
2. The server draws 9 rival countries at random from the rest of the catalogue.
3. Each country starts owned by a different player, with soldiers equal to its soldier value.
4. Turn order is shuffled, so you can go anywhere from 1st to 10th.

### A turn

| Phase | When | What happens |
|---|---|---|
| **Reinforce** | Round 2 onward | You receive 2 soldiers per country you hold and must place all of them before doing anything else. You can place them in several batches |
| **Action** | Every turn | In any order: attack once, transfer troops as often as you like, then end or skip your turn |
| **Attacking** | During an attack | Roll or retreat until the battle ends |

Round 1 has no reinforcements, so every player starts directly in the Action phase.

### Attacking
* You can attack **any** enemy country from **any** of your countries. Distance and borders do not matter.
* The attacking country needs at least 2 soldiers, and you get one attack per turn.
* Each roll, both sides roll `min(attacker soldiers - 1, defender soldiers)` dice.
* Dice are sorted and paired highest against highest. The lower die loses one soldier. **Ties kill nobody.**
* You choose to roll again or retreat after each exchange.

| Battle ends when | Result | Turn afterwards |
|---|---|---|
| Defender reaches 0 | **Conquered** | Continues: you can still transfer troops |
| Attacker is down to 1 soldier | **Repelled** | Continues: you can still transfer troops |
| You press Retreat | **Stopped** | Your turn ends immediately |

### Conquest
* The new garrison is `max(2, floor(conquered country's soldier value / 2))`. India (9) gives 4 and Vatican City (1) gives 2.
* The attacking soldiers **do not** move in. They stay in the country they attacked from.
* After conquering, you can use a normal transfer to send more troops in. The Action panel offers a shortcut.

### Transfers
* Move soldiers between any two countries you own, as many times as you like in the Action phase.
* The source country must keep at least 1 soldier.
* Transfers are not possible during a battle or after a retreat, because a retreat ends the turn.

### Ending the game

| Situation | Result |
|---|---|
| You own all 10 countries | **Victory** |
| An NPC owns all 10 countries | **Defeat**, with that NPC as winner |
| You lose your last country | **Defeat** immediately, even if several NPCs remain |
| You press Abandon | **Abandoned**, which counts as a loss in your stats |

An NPC with no countries is eliminated and its turns are skipped.

### Battle odds
These are the odds of winning an attack fought to the end, using the game's own simulation (300 trials per matchup). "3 vs 2" means the attacking country holds 3 soldiers, including the one that must stay behind.

| Attacker vs defender | Win chance | Average attacker losses |
|---|---|---|
| 2 vs 1 | 51% | 0.5 |
| 3 vs 1 | 75% | 0.7 |
| 3 vs 2 | 47% | 1.3 |
| 4 vs 2 | 65% | 1.5 |
| 5 vs 3 | 64% | 2.2 |
| 6 vs 3 | 73% | 2.6 |
| 9 vs 4 | 79% | 3.7 |
| 9 vs 9 | 47% | 5.6 |
| 5 vs 9 | 14% | 3.7 |

---

## 3. Nations and how you choose one

### Catalogue
There are **121 countries** with 2025 Worldometers population figures, stored in `Backend/src/data/worldCountries.js`.

| Region | Countries |
|---|---|
| Africa | 36 |
| Asia | 33 |
| Europe | 29 |
| South America | 10 |
| North America | 9 |
| Oceania | 4 |

### Soldier value
A country's starting army comes only from its population.

| Population up to | Soldiers | Countries | Nations |
|---|---|---|---|
| 5M | 1 | 15 | Mongolia, Uruguay, Qatar, Namibia, Jamaica, Botswana, Lesotho, Mauritius, Eswatini, Fiji, Luxembourg, Malta, Iceland, Monaco, Vatican City |
| 10M | 2 | 19 | Greece, Togo, Hungary, Israel, Austria, Switzerland, Sierra Leone, Laos, Libya, Paraguay, Bulgaria, Serbia, Denmark, Singapore, Finland, Norway, Ireland, New Zealand, Costa Rica |
| 25M | 3 | 29 | Burkina Faso, Sri Lanka, Malawi, Zambia, Chad, Kazakhstan, Chile, Somalia, Senegal, Romania, Guatemala, Netherlands, Ecuador, Cambodia, Zimbabwe, Rwanda, Bolivia, Tunisia, Haiti, Belgium, Jordan, Dominican Republic, United Arab Emirates, Cuba, Papua New Guinea, Sweden, Czechia, Portugal, Azerbaijan |
| 50M | 4 | 27 | Spain, Algeria, Iraq, Argentina, Afghanistan, Yemen, Canada, Angola, Ukraine, Morocco, Poland, Uzbekistan, Malaysia, Mozambique, Ghana, Peru, Saudi Arabia, Madagascar, Cote d'Ivoire, Cameroon, Nepal, Venezuela, Niger, Australia, North Korea, Syria, Mali |
| 75M | 5 | 12 | Thailand, Tanzania, United Kingdom, France, South Africa, Italy, Kenya, Myanmar, Colombia, South Korea, Sudan, Uganda |
| 100M | 6 | 3 | Iran, Turkey, Germany |
| 125M | 7 | 5 | Japan, Egypt, Philippines, DR Congo, Vietnam |
| 150M | 8 | 3 | Russia, Ethiopia, Mexico |
| Over 150M | 9 | 8 | India, China, United States, Indonesia, Pakistan, Nigeria, Brazil, Bangladesh |

The average country has 3.8 soldiers, so the average rival is much weaker than a top-tier nation.

### The selection flow
Route: `/new`. Screen: `Frontend/src/screens/NewGameScreen.tsx`.

1. Search by name (debounced).
2. Filter by region: All, or one of the six regions.
3. Filter by strength: Any, Small (1-3), Medium (4-6) or Large (7-9).
4. Sort: A-Z, Strongest or Most populous.
5. Tap a nation tile. Each tile shows the flag, name, population, soldier count and a 9-pip strength bar.
6. A summary card appears above the search box, showing the flag, region, population and starting soldiers.
7. Optionally name the campaign (3 to 80 characters). The default is `<username>'s campaign from <country>`.
8. Choose **Public** (anyone with the link can watch) or **Private**. Public is the default.
9. Press **Start campaign as `<country>`**. The game is created and opens on the Game screen.

### What your choice changes
* Your starting soldiers: from 1 to 9.
* Nothing else. Nations have no special abilities, regions have no effect, and geography plays no part in battle.
* You do not see or choose your rivals, the difficulty or the number of opponents before the game starts.

---

## 4. The NPC commanders

Every game has the same mix of 9 NPCs: **3 Aggressive, 2 Defensive, 2 Balanced and 2 Opportunist**, shuffled across the rival nations. Personalities are shown openly in the Commanders panel.

| Profile | Name | Icon | Odds needed to attack | Retreats below | Reinforcements on best attack | Priorities | End of turn move |
|---|---|---|---|---|---|---|---|
| Aggressive | Warlord of X | Flame | 45% | 20% | 100% | Only profile that targets the human | Merges 2nd-largest army into the largest |
| Defensive | Guardian of X | Shield | 75% | 50% | 25% | Avoids losses | Moves 50% of the gap to its weakest country |
| Balanced | General of X | Git-compare | 60% | 35% | 60% | Strongest focus on the board leader | Moves 33% of the gap to its weakest country |
| Opportunist | Strategist of X | Eye | 55% | 40% | 80% | Largest bonus for eliminating a player | Moves 25% of the gap to its weakest country |

How an NPC decides:
1. **Reinforce:** finds the country that gives its best next attack, masses its share there, and spreads the rest over its weakest garrisons.
2. **Attack:** scores every possible attack using win chance, prize and expected losses, then takes the best one that meets its required odds.
3. **Roll or stop:** re-checks the odds before each roll and retreats below its limit.
4. **Reposition:** makes at most one transfer, then ends the turn.

The required odds drop by 1 point per round, down to a floor (30% Aggressive, 45% Defensive, 40% Balanced, 35% Opportunist), so cautious NPCs cannot stall forever.

NPCs use the same rule-checked moves as the player, so they cannot cheat. Every decision comes with a plain-English reason shown in the turn banner and the war log.

---

## 5. User workflows

### First-time player
```
App opens -> Splash (logo, about 2 seconds)
          -> Home (signed out): logo, tagline, 4 feature cards
          -> "Enlist now" -> Create account (username, email, password)
          -> Home (signed in): commander card, empty campaign list
          -> "New campaign" -> Choose your nation -> Start campaign
          -> War Room (the Game screen)
```

### Returning player
```
App opens -> Splash restores the saved session
          -> My Campaigns -> tap an active campaign -> continues where it stopped
                          -> or "New campaign"
```

### One round in the War Room
```
Waiting for your turn
  NPC moves play out one at a time, with reasons shown in the banner
  Optional: Fast-forward, Pause, Resume
        |
        v
"Your move, commander"
  Round 2 onward: tap your countries to place reinforcements -> Deploy
        |
        v
Action phase (starts in Attack mode, then keeps the last mode you used)
  Attack:   tap your country -> tap an enemy -> Launch attack
              -> Roll N dice (repeat) or Retreat
              -> Conquered: optionally "Choose troops" to move more in, then End turn
              -> Repelled: transfer if you want, then End turn
              -> Retreat: the turn ends straight away
  Transfer: switch to Transfer troops -> tap source -> tap destination
              -> choose an amount -> Move
  Neither:  Skip turn
        |
        v
NPC turns play again until the game ends
        |
        v
Game over card: Victory, Defeat or Abandoned
  -> Replay battles, or New campaign
```

### Spectator
```
Shared link (/game/<id>) or the Live Wars tab
  -> Opens the same War Room, read-only
  -> Board, war log and battles refresh every 2.5 seconds
  -> "Start your own" appears if signed out
```

Spectators only see movement while the owner has the game open, because NPC turns are driven by the owner's device. Private games return "not found" to everyone except the owner.

### Reviewing
* **Replay:** the film icon in the War Room header opens the battle list. Tap a battle to replay each dice exchange with Prev, Play/Pause and Next.
* **Stats:** the Stats tab shows your record, the leaderboard and world analytics.

---

## 6. Navigation map

```
Stack
  Main (bottom tabs)
    Lobby    "My Campaigns"   /          flag icon
    Explore  "Live Wars"      /explore   globe icon
    Profile  "Stats"          /profile   chart icon
  Auth       "Sign in"        /login     modal
  NewGame    "New Campaign"   /new
  Game       "War Room"       /game/:id  title becomes the campaign name
```

The web build uses these as real URLs, and the native deep link scheme is `conquest://`.

---

## 7. Screens

All screens except the splash share one shell, `Screen.tsx`: war-room backdrop, safe area, scrolling content and a centred max width (1100px by default).

### Splash
Native splash first (logo on navy), then an animated overlay: the logo rises in, glows and a progress bar fills. It shows for at least 1.8 seconds and fades out once the saved session is restored.

### Home, signed out (`LobbyScreen.tsx`)
```
+-----------------------------------------+
|            [ CONQUEST logo ]            |
|  Conquer all ten nations to rule the    |
|  world.                                 |
|  Choose your homeland, outwit nine...   |
|     [ Enlist now ]   [ Log in ]         |
|           Watch live wars               |
|                                         |
| [10 Nations] [9 AI Commanders]          |
| [Dice Battles] [Live War Report]        |
+-----------------------------------------+
| My Campaigns | Live Wars | Stats        |
+-----------------------------------------+
```

### Home, signed in (`LobbyScreen.tsx`)
```
+-----------------------------------------+
| [emblem] COMMANDER                      |
|          username                       |
|          [Campaigns] [Victories]        |
|          [Conquests]                    |
| [ New campaign ]                        |
+-----------------------------------------+
| YOUR CAMPAIGNS                          |
| [ Search your campaigns ]               |
| (All) (Active) (Completed) (Abandoned)  |
| +-------------------------------------+ |
| | flag  Title              [status]   | |
| |       owner | Round | nations |     | |
| |       battles                       | |
| |       countries, soldiers | result  | |
| +-------------------------------------+ |
| [ Load more ]                           |
+-----------------------------------------+
```

The list shows 12 campaigns per page and refreshes whenever the screen regains focus.

### Sign in (`AuthScreen.tsx`)
A centred modal column, 460px at most, with the logo, the tagline "Ten nations. One world. Roll for it." and a card with two chips: Log in and Create account.

| Mode | Fields | Rules |
|---|---|---|
| Log in | Username or email, password | Both are required |
| Create account | Username, email, password | Username: 3-20 letters, numbers or underscores. Password: 8+ characters with a letter and a number |

Rules are checked in the app first, then again on the server. Both forms are rate limited to 30 attempts per 15 minutes.

### Choose your nation (`NewGameScreen.tsx`)
```
+-----------------------------------------+
| Choose your nation                      |
| Your soldiers come from your population |
|                                         |
| +-- appears once a nation is tapped --+ |
| | flag  South Africa                  | |
| |       Africa | 64.7M | 5 soldiers   | |
| |       [ Campaign name ]             | |
| |       (Public) (Private)            | |
| |       [ Start campaign as ... ]     | |
| +-------------------------------------+ |
|                                         |
| [ Search 120+ countries ]               |
| (All regions) (Africa) (Asia) ...       |
| (Any) (Small) (Medium) (Large) | sorts  |
|                                         |
| [tile] [tile] [tile] [tile]             |
| [tile] [tile] [tile] [tile]             |
+-----------------------------------------+
```

The grid has 4 columns at 1000px and wider, 3 at 700px and wider, otherwise 2. Signed-out visitors see a "Log in to start a campaign" message instead.

### Live Wars (`ExploreScreen.tsx`)
A heading and short explanation, then the same list as My Campaigns, showing every public game, including finished ones. You can search by title or commander name.

### Stats (`ProfileScreen.tsx`)
Three cards, with pull to refresh:

| Card | Contents |
|---|---|
| **Your record** (or a login prompt) | Campaigns, victories and win rate, defeats, battles won, countries conquered, enemy soldiers defeated, average game length, favourite nations, Log out |
| **Leaderboard** | Top 10 by wins, then conquests. Top 3 ranks are gold |
| **World analytics** | Commanders, campaigns, battles, a "Who wins the world?" bar chart by profile, most popular starting nations |

### War Room (`GameScreen.tsx`)
The main screen. See section 8.

---

## 8. The War Room in detail

### Wide layout (1024px and wider, 1400px at most)
```
+----------------------------------------------------------------+
| <- Campaign title                          [film] [share]      |
+----------------------------------------------------------------+
| ROUND 3  o  Your move, commander                               |
| (Fast-forward NPCs)  [Pause]                        [Abandon]  |
+--------------------------------------+-------------------------+
| BATTLE PANEL (when there is one)     | COMMANDERS              |
|                                      | 1 o Warlord of X  2  9  |
| ACTION PANEL (your turn only)        | 2 o username      3 12  |
|                                      | ...                     |
| BOARD                                |                         |
| [tile] [tile] [tile] [tile]          | WAR LOG                 |
| [tile] [tile] [tile] [tile]          | (All)(Battles)(NPC)...  |
| [tile] [tile]                        | events, newest first    |
+--------------------------------------+-------------------------+
```

The left column is 63% of the width.

### Narrow layout (under 1024px)
A single column in this order: turn banner, game over card, battle panel, action panel, board, commanders, war log.

### Board columns

| Window width | Tiles per row |
|---|---|
| Under 512px | 2 |
| 512 to 751px | 3 |
| 752 to 1023px | 4 |
| 1024 to 1174px | 3 (the sidebar takes space) |
| 1175px and wider | 4 |

### Turn banner
* Round badge, a dot in the current player's colour, and a headline such as "Your move, commander" or "Warlord of Egypt: Battle in progress".
* During NPC turns, a box shows the NPC's reason for its latest move.
* Owner controls: Fast-forward toggle, Pause or Resume, Abandon (asks for confirmation).
* Spectators see "Watching X's campaign live. Only they can make moves."

### Country tile (`CountryTile.tsx`)
```
+----------------------+  top bar and glow in the owner's colour
| flag      home * [x] |  home icon, current-turn dot, combat icon
| South Africa         |
| people 5  +2    64.7M|  soldiers, pending reinforcements, population
| Warlord of Egypt     |  owner name in the owner's colour
+----------------------+
```

| Tile state | Look |
|---|---|
| Can be selected | Faint gold border |
| Selected source | Gold border with glow |
| Selected target | Red border with glow |
| Attacking | Orange border and lightning icon |
| Defending | Blue border and shield icon |

### Action panel (`ActionPanel.tsx`)
Shown only on your turn. Its content follows the phase.

| Phase | Contents |
|---|---|
| Reinforce | Soldiers to place, one chip per placement, "All to `<strongest>`", Reset, "Deploy N" |
| Action | Attack / Transfer chips, Skip turn or End turn, a step-by-step instruction, and the confirm button once a source and target are chosen |
| After conquest | Green banner: "`<country>` is yours. Send extra troops?" with Choose troops |
| Transfer | Plus/minus stepper, a Max chip, and "Move N" |
| Attacking | A short note pointing to the battle panel |

### Battle panel (`BattlePanel.tsx`)
```
+-------------------------------------------+
| [Battle raging]  Exchange 2               |
| flag South Africa   VS   flag Germany     |
| username                 General of ...   |
| 7                                       4 |
| [die] ^ [die]   [die] v [die]             |
| War correspondent            [AI live]    |
| "A brutal volley tears through..."        |
| [ Roll 4 dice ]            [ Retreat ]    |
+-------------------------------------------+
```

* Dice tumble for about 0.65 seconds, then the losing die dims. Up to 8 pairs are shown.
* The badge shows **AI live** for Groq text or **Dispatch** for the built-in fallback text.
* After the battle, the outcome stays on screen with the garrison gained, until you close it or the next battle replaces it.
* NPC battles appear in the same panel, without controls.

### Commanders panel (`PlayersPanel.tsx`)
All 10 players in turn order, each with a colour dot, flag, name, profile (or "You"), countries and soldiers. The current player is highlighted. Eliminated players are faded, struck through and marked with their round.

### War log (`EventFeed.tsx`)
Newest first, with filters: All, Battles, NPC thinking, Turns & troops. Each row has an icon and round number. NPC decisions show a gold "Why:" line and battle rows show the correspondent's text. It shows 40 rows at a time with "Show older events", and keeps the latest 300 events in memory.

### NPC playback speed

| Setting | Delay between moves |
|---|---|
| Normal step | 1.1 seconds |
| Normal dice roll | 1.5 seconds |
| Fast-forward | 0.3 seconds |

Fast-forward still shows every move, and it only asks Groq to narrate the deciding roll of each battle.

---

## 9. Visual design

Defined in `Frontend/src/theme.ts`.

| Element | Value |
|---|---|
| Background | `#0A0F1C`, gradient `#0F1C3B` to `#04060C`, tactical grid image, gold glow from the top |
| Surfaces | `#111827`, raised `#1A2335`, glass cards `rgba(14,21,38,.86)` |
| Accent | Gold `#F5B83D`, button gradient `#FFE08A` to `#C9841F` |
| Text | `#E8EEF8`, muted `#8B98B0` |
| Status | Success `#22C55E`, danger `#EF4444`, info `#60A5FA` |
| Battle | Attacker orange `#F97316`, defender blue `#38BDF8` |
| Type | Russo One for titles, numbers and buttons; system font for body text |
| Sizes | 34, 24, 18, 15, 13, 11 |
| Spacing | 4, 8, 12, 16, 24, 32 |
| Radius | 6, 10, 16, pill |
| Player colours | 10 fixed colours. The human is always blue `#3B82F6` |
| Logo | War shield, globe with a planted flag, crossed swords, ten stars. Sources in `Frontend/assets/brand/` |
| Flags | Images from `flagcdn.com`. The country code shows when offline |

---

## 10. Feature list

**Core game**
* Choice of 121 real countries, with armies sized by population
* Reinforce, attack, transfer, skip and retreat, with every rule enforced on the server
* Secure random dice, animated on screen
* Win, defeat and abandon endings, and automatic elimination of beaten players

**AI**
* Four NPC personalities using Monte Carlo odds
* A visible reason for every NPC decision
* Groq battle commentary, with built-in fallback text if it is unavailable

**Campaigns and social**
* Multiple campaigns, which resume where you left them
* Public or private games, with shareable links
* Live spectating without an account
* Live Wars list with search, status filter and paging

**History and stats**
* Battle history with step-by-step replay
* War log with filters
* Personal stats, leaderboard and platform analytics

**Accounts and safety**
* Register, log in and saved sessions (JWT with bcrypt password hashing)
* Only the owner can play; double moves are blocked by optimistic locking
* Input validation, rate limiting (600 API requests per minute) and CORS allow-list

**Presentation**
* Logo, app icons, native and animated splash, loading screens
* Responsive layout for phone, tablet and desktop
* Real web URLs and native deep links

---

## 11. Where to change things

| To change | Look in |
|---|---|
| Rule numbers (reinforcements, tiers, reward) | `Backend/src/config/gameRules.js` |
| Game rules and turn flow | `Backend/src/engine/Game.js` |
| Dice and battle logic | `Backend/src/engine/BattleEngine.js`, `Dice.js` |
| New game setup, rival draw, NPC names | `Backend/src/engine/GameFactory.js` |
| NPC personalities | `Backend/src/engine/ai/profiles.js` |
| NPC decision logic | `Backend/src/engine/ai/NpcStrategy.js`, `NpcController.js` |
| Battle commentary prompt and fallback text | `Backend/src/services/commentary.service.js` |
| Saving moves, access control | `Backend/src/services/game.service.js` |
| Data sent to the app | `Backend/src/services/gameView.js`, `Frontend/src/types.ts` |
| Nation list | `Backend/src/data/worldCountries.js`, then `npm run seed` |
| Colours, fonts, spacing | `Frontend/src/theme.ts` |
| Routes and tabs | `Frontend/src/navigation/RootNavigator.tsx` |
| War Room layout | `Frontend/src/screens/GameScreen.tsx` |
| Board tile | `Frontend/src/components/CountryTile.tsx` |
| Your turn controls | `Frontend/src/components/ActionPanel.tsx`, `hooks/useMovePlanner.ts` |
| Battle display, dice | `Frontend/src/components/BattlePanel.tsx`, `Dice.tsx` |
| NPC playback, spectator polling | `Frontend/src/hooks/useGameSession.ts`, timings in `src/config.ts` |
| Nation selection | `Frontend/src/screens/NewGameScreen.tsx` |

Working notes:
* `Frontend/AGENTS.md` says to use Expo Router, but this project deliberately uses React Navigation. Keep React Navigation.
* Rules live on the server. `useMovePlanner.ts` copies some of them for instant feedback, so change both together.
* Hosting is serverless on Vercel, so nothing can run in the background and all state must live in MongoDB.
* Add or change tests in `Backend/test/` when rules change (`npm test`).

### Rules that came from the exam brief
These are recorded in the README and code comments as brief requirements or as agreed interpretations of the brief. Check the INF4001N brief and marksheet before changing them:

* 10 countries, 9 NPCs, soldier tiers from population
* 2 reinforcements per country from round 2
* One attack per turn, dice rules, ties kill nobody
* Conquest reward formula
* Stopping an attack ends the turn
* Every NPC decision has a visible justification
* Spectators can watch by URL, and only the owner can play

---

## 12. Gaps found while reading the code

None of these have been changed yet. They come from reading the code, not from a running game.

### Small inconsistencies
* The "1000px = 5 columns" branch in `boardColumns()` can never run, because the board never reaches 1000px wide.
* Windows from 1024 to 1174px show fewer tiles per row (3) than narrower tablet windows (4).
* The README says 120 countries in places. The catalogue has 121.
* The server rejects campaign names of 1 or 2 characters, but the name field does not warn before you press Start.
* `Frontend/app.json.ljm5zgCWmfAuD5b4T3-Zj3-rq_SKBPAab45fFI37ee4` looks like a leftover temp file.

### Player information gaps
* NPCs calculate win odds, but the player is not shown odds before launching an attack.
* Tiles do not show a country's soldier value or conquest reward, so the size of the prize is hidden.
* Per-player stats (attacks, conquests, soldiers lost and killed) reach the app, but the Commanders panel does not show them.
* The game explains rules only through the panel's instructions. There is no tutorial or rules screen.
* After attacking, tiles stop responding until you switch to Transfer troops. The panel explains this, but it does not switch for you.

### Gameplay and balance
* The board is a tile grid with no world map, and geography has no effect on play.
* Nation choice only sets starting soldiers. Nations have no traits or regional identity.
* Starting strength is uneven: 1 to 9 soldiers, and rivals are drawn with no balancing.
* The 15 one-soldier nations cannot attack or transfer in round 1. All they can do is press Skip turn.
* There is no difficulty setting, and no choice of rivals or number of opponents.
* There is only one game length and one win condition.

### Pacing and interface
* Waiting for 9 NPCs is the biggest pause in the game. At normal speed, a typical NPC turn takes roughly 8 seconds plus network and Groq time, so about a minute or more per round (estimate).
* Fast-forward is a toggle you turn on each session. It does not skip NPC turns.
* On a phone, the board sits below the battle and action panels, and the screen does not scroll to what changed.
* There is no sound, no conquest animation on the board, and no victory celebration beyond the game over card.
* There is no undo for reinforcements once deployed.
* Games are single-player only, and NPC turns only advance while the owner has the game open.

---

## 13. Improvements I want

Add your ideas here. Note whether each one changes a rule from the brief (section 11).

- [ ]
- [ ]
- [ ]
