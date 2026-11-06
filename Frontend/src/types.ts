// Shapes returned by the CONQUEST API (see Backend/src/services/gameView.js).

export type Phase = 'reinforce' | 'action' | 'attacking' | 'game_over';
export type GameStatus = 'active' | 'completed' | 'abandoned';
export type NpcProfile = 'aggressive' | 'defensive' | 'balanced' | 'opportunist';
export type BattleOutcome = 'in_progress' | 'conquered' | 'repelled' | 'stopped';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  battlesFought: number;
  battlesWon: number;
  countriesConquered: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'player' | 'admin';
  stats: UserStats;
  winRate: number;
  createdAt: string;
}

export interface WorldCountry {
  code: string;
  name: string;
  region: string;
  population: number;
  soldierValue: number;
  flag: string;
}

export interface Country {
  code: string;
  name: string;
  region: string;
  population: number;
  soldierValue: number;
  soldiers: number;
  ownerId: string;
}

export interface PlayerView {
  id: string;
  name: string;
  isNPC: boolean;
  npcProfile: NpcProfile | null;
  color: string;
  homeCountry: string;
  isEliminated: boolean;
  eliminatedInRound: number | null;
  stats: { attacksLaunched: number; conquests: number; soldiersLost: number; soldiersKilled: number };
  countryCount: number;
  soldierCount: number;
}

export interface GameView {
  id: string;
  title: string;
  status: GameStatus;
  visibility: 'public' | 'private';
  round: number;
  turnNumber: number;
  phase: Phase;
  pendingReinforcements: number;
  hasAttackedThisTurn: boolean;
  activeAttack: { from: string; to: string; battleId: string } | null;
  currentPlayerId: string;
  turnOrder: string[];
  players: PlayerView[];
  countries: Country[];
  winnerId: string | null;
  endReason: 'conquest' | 'defeat' | 'abandoned' | null;
  eventSeq: number;
  battleCount: number;
  owner: { id: string; username: string | null };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  viewer: { isOwner: boolean; isSpectator: boolean; canAct: boolean; canAdvanceNpc: boolean };
}

export interface GameSummary {
  id: string;
  title: string;
  status: GameStatus;
  visibility: 'public' | 'private';
  round: number;
  owner: { id: string; username: string | null };
  human?: { name: string; homeCountry: string; countryCount: number; soldierCount: number; isEliminated: boolean };
  currentPlayerName: string | null;
  winnerName: string | null;
  endReason: GameView['endReason'];
  playersRemaining: number;
  battleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Commentary {
  text: string;
  source: 'llm' | 'fallback';
}

export interface GameEvent {
  seq: number;
  round: number;
  type: string;
  actorId: string | null;
  actorName: string | null;
  message: string;
  reasoning: string | null;
  battleId: string | null;
  data: { commentary?: Commentary; [key: string]: unknown };
  createdAt: string;
}

export interface Combatant {
  player: string;
  name: string;
  country: string;
  countryName: string;
  startingSoldiers: number;
}

export interface Exchange {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
  attackerRemaining: number;
  defenderRemaining: number;
  commentary: Commentary | null;
}

export interface Battle {
  id: string;
  gameId: string;
  round: number;
  turnNumber: number;
  attacker: Combatant;
  defender: Combatant;
  exchanges: Exchange[];
  outcome: BattleOutcome;
  soldiersGained: number;
  summary: string | null;
  summarySource: Commentary['source'] | null;
  createdAt: string;
  endedAt: string | null;
}

export interface BattleSummary {
  id: string;
  round: number;
  attacker: { name: string; country: string; countryName: string };
  defender: { name: string; country: string; countryName: string };
  outcome: BattleOutcome;
  exchangeCount: number;
  soldiersGained: number;
  createdAt: string;
}

export interface NpcDecision {
  type: string;
  reasoning: string;
}

export interface ActionResponse {
  game: GameView;
  events: GameEvent[];
  battle: Battle | null;
  decision?: NpcDecision;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type GameAction =
  | { type: 'reinforce'; allocation: { country: string; soldiers: number }[] }
  | { type: 'transfer'; from: string; to: string; soldiers: number }
  | { type: 'attack'; from: string; to: string }
  | { type: 'roll' }
  | { type: 'stop' }
  | { type: 'endTurn' };

export interface MyStats {
  profile: User;
  gamesByStatus: Partial<Record<GameStatus, number>>;
  totals: {
    attacksLaunched: number;
    conquests: number;
    soldiersLost: number;
    soldiersKilled: number;
    averageRounds: number;
    longestGame: number;
  };
  favouriteCountries: { code: string; name?: string; games: number; wins: number }[];
}

export interface PlatformStats {
  users: number;
  games: number;
  battles: number;
  gamesByStatus: Record<string, number>;
  battleOutcomes: Record<string, number>;
  winsByProfile: Record<string, number>;
  popularStartingCountries: { code: string; name?: string; games: number; wins: number }[];
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  stats: UserStats;
  winRate: number;
}
