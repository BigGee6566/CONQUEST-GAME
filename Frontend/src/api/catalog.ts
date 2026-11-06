import type { LeaderboardEntry, MyStats, Paginated, PlatformStats, WorldCountry } from '../types';
import { http } from './client';

export interface CountryQuery {
  search?: string;
  region?: string;
  minSoldiers?: number;
  maxSoldiers?: number;
  sort?: 'name' | '-name' | 'population' | '-population' | 'soldierValue' | '-soldierValue';
}

export const countriesApi = {
  async list(query: CountryQuery) {
    const { data } = await http.get<Paginated<WorldCountry> & { regions: string[] }>('/countries', {
      params: { ...query, limit: 200 },
    });
    return data;
  },
};

export const statsApi = {
  async me() {
    return (await http.get<MyStats>('/stats/me')).data;
  },

  async leaderboard() {
    return (await http.get<{ items: LeaderboardEntry[] }>('/stats/leaderboard')).data.items;
  },

  async platform() {
    return (await http.get<PlatformStats>('/stats/platform')).data;
  },
};
