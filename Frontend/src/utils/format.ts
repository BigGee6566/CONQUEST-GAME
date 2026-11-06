import type { NpcProfile } from '../types';

export function formatPopulation(population: number): string {
  if (population >= 1e9) return `${(population / 1e9).toFixed(2)}B`;
  if (population >= 1e6) return `${(population / 1e6).toFixed(1)}M`;
  if (population >= 1e3) return `${Math.round(population / 1e3)}K`;
  return String(population);
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const PROFILE_META: Record<NpcProfile, { label: string; icon: string; blurb: string }> = {
  aggressive: { label: 'Aggressive', icon: 'flame', blurb: 'Attacks on thin odds and hunts the human' },
  defensive: { label: 'Defensive', icon: 'shield', blurb: 'Only strikes with overwhelming odds' },
  balanced: { label: 'Balanced', icon: 'git-compare', blurb: 'Weighs risk and targets the leader' },
  opportunist: { label: 'Opportunist', icon: 'eye', blurb: 'Pounces on players it can eliminate' },
};

export const PHASE_LABEL: Record<string, string> = {
  reinforce: 'Deploying reinforcements',
  action: 'Planning moves',
  attacking: 'Battle in progress',
  game_over: 'Game over',
};
