export const colors = {
  background: '#0A0F1C',
  surface: '#111827',
  surfaceRaised: '#1A2335',
  border: '#263247',
  text: '#E8EEF8',
  textMuted: '#8B98B0',
  accent: '#F5B83D',
  accentText: '#1A1203',
  danger: '#EF4444',
  success: '#22C55E',
  info: '#60A5FA',
  attacker: '#F97316',
  defender: '#38BDF8',
  overlay: 'rgba(5, 8, 15, 0.78)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = { hero: 34, title: 24, heading: 18, body: 15, small: 13, tiny: 11 } as const;

// Russo One: a heavy, squared display face for titles, numbers and buttons (loaded in App.tsx).
export const fonts = { display: 'RussoOne_400Regular' } as const;

export const gradients = {
  gold: ['#FFE08A', '#F5B83D', '#C9841F'],
  backdrop: ['#0F1C3B', '#070B16', '#04060C'],
  topGlow: ['rgba(245, 184, 61, 0.12)', 'rgba(245, 184, 61, 0)'],
  panel: ['rgba(32, 48, 88, 0.55)', 'rgba(13, 19, 36, 0.2)'],
} as const;

export const surfaces = {
  card: 'rgba(14, 21, 38, 0.86)',
  cardBorder: 'rgba(148, 163, 184, 0.16)',
  shadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
  goldGlow: '0 6px 20px rgba(245, 184, 61, 0.35)',
} as const;
