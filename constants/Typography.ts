import { Platform } from 'react-native';

const base = Platform.select({ ios: 'System', android: 'Roboto' });

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  h4: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
  tabLabel: { fontSize: 10, fontWeight: '500' as const, lineHeight: 12 },
  mono: { fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), lineHeight: 18 },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  screen: 16,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
