import { Platform } from 'react-native';

const trimSlash = (url: string) => url.replace(/\/+$/, '');

// Set EXPO_PUBLIC_API_URL in Frontend/.env (local) or in Vercel's environment variables (deployed).
// Android emulators reach the host machine at http://10.0.2.2:4000 rather than localhost.
export const API_URL = trimSlash(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000');

// Base URL of the deployed web app, used to build shareable game links from native builds.
function webBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return trimSlash(process.env.EXPO_PUBLIC_WEB_URL ?? '');
}

export function gameShareUrl(gameId: string): string {
  const base = webBaseUrl();
  return base ? `${base}/game/${gameId}` : `conquest://game/${gameId}`;
}

export const PLAYBACK = Object.freeze({
  npcStepMs: 1100,
  npcRollMs: 1500,
  fastForwardMs: 300,
  spectatorPollMs: 2500,
  diceRollMs: 650,
});
