import axios, { AxiosError } from 'axios';
import { API_URL } from '../config';

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: { path: string; message: string }[] };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  fieldError(path: string): string | undefined {
    return this.details.find((d) => d.path === path)?.message;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export const http = axios.create({ baseURL: `${API_URL}/api`, timeout: 20_000 });

http.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorPayload>) => {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data?.error;
    // An expired or revoked session: drop it so the app falls back to signed-out mode.
    if (status === 401 && authToken) onUnauthorized?.();
    if (payload?.message) {
      return Promise.reject(new ApiError(payload.message, status, payload.code ?? 'ERROR', payload.details));
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('The server took too long to respond.', 0, 'TIMEOUT'));
    }
    return Promise.reject(new ApiError('Cannot reach the CONQUEST server. Check your connection.', status, 'NETWORK'));
  },
);

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}
