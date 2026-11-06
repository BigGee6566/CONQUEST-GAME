import type { User } from '../types';
import { http } from './client';

interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  async register(input: { username: string; email: string; password: string }) {
    return (await http.post<AuthResponse>('/auth/register', input)).data;
  },

  async login(input: { identifier: string; password: string }) {
    return (await http.post<AuthResponse>('/auth/login', input)).data;
  },

  async me() {
    return (await http.get<{ user: User }>('/auth/me')).data.user;
  },
};
