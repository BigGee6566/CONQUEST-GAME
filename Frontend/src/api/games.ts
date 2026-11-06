import type {
  ActionResponse,
  Battle,
  BattleSummary,
  GameAction,
  GameEvent,
  GameStatus,
  GameSummary,
  GameView,
  Paginated,
} from '../types';
import { http } from './client';

export interface GameListQuery {
  scope: 'mine' | 'public';
  status?: GameStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const gamesApi = {
  async list(query: GameListQuery) {
    return (await http.get<Paginated<GameSummary>>('/games', { params: query })).data;
  },

  async create(input: { homeCountry: string; title?: string; visibility: 'public' | 'private' }) {
    return (await http.post<{ game: GameView; events: GameEvent[] }>('/games', input)).data;
  },

  async get(gameId: string) {
    return (await http.get<{ game: GameView }>(`/games/${gameId}`)).data.game;
  },

  async events(gameId: string, params: { after?: number; tail?: number; limit?: number }) {
    return (await http.get<{ items: GameEvent[]; latestSeq: number }>(`/games/${gameId}/events`, { params })).data;
  },

  async battles(gameId: string, page = 1) {
    return (await http.get<Paginated<BattleSummary>>(`/games/${gameId}/battles`, { params: { page } })).data;
  },

  async battle(gameId: string, battleId: string) {
    return (await http.get<{ battle: Battle }>(`/games/${gameId}/battles/${battleId}`)).data.battle;
  },

  async act(gameId: string, action: GameAction) {
    return (await http.post<ActionResponse>(`/games/${gameId}/actions`, action)).data;
  },

  async npcStep(gameId: string, fastForward: boolean) {
    return (await http.post<ActionResponse>(`/games/${gameId}/npc-step`, { fastForward })).data;
  },

  async abandon(gameId: string) {
    return (await http.post<ActionResponse>(`/games/${gameId}/abandon`)).data;
  },
};
