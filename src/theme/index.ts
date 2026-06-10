import { createContext, useContext } from 'react';

// Evergreen theme — deep forest green with autumn amber accents.
export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryMuted: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  chipBg: string;
  accent: string;
  danger: string;
  dangerBg: string;
  success: string;
  tabBar: string;
  overlay: string;
  // Semantic
  bannerWarningBg: string;
  bannerWarningText: string;
  bannerInfoBg: string;
  bannerInfoText: string;
}

export const lightColors: ThemeColors = {
  primary: '#1B6B4A',
  primaryMuted: '#2D8C63',
  background: '#FAFDF7',
  card: '#FFFFFF',
  text: '#1A2E23',
  textSecondary: '#3F5446',
  muted: '#5E7D6B',
  border: '#C5D9CD',
  chipBg: '#E0EDE5',
  accent: '#D97706',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  success: '#16A34A',
  tabBar: '#F0F7F2',
  overlay: 'rgba(0,0,0,0.4)',
  bannerWarningBg: '#FEF3C7',
  bannerWarningText: '#92400E',
  bannerInfoBg: '#D1FAE5',
  bannerInfoText: '#065F46',
};

export const darkColors: ThemeColors = {
  primary: '#34D399',
  primaryMuted: '#2BAF7E',
  background: '#0F1A14',
  card: '#1A2E23',
  text: '#E8F5E9',
  textSecondary: '#A8CBB5',
  muted: '#7CA88A',
  border: '#2D4A38',
  chipBg: '#243D30',
  accent: '#FBBF24',
  danger: '#F87171',
  dangerBg: '#451A1A',
  success: '#34D399',
  tabBar: '#0F1A14',
  overlay: 'rgba(0,0,0,0.6)',
  bannerWarningBg: '#422006',
  bannerWarningText: '#FDE68A',
  bannerInfoBg: '#064E3B',
  bannerInfoText: '#6EE7B7',
};

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

export interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
