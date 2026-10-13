/**
 * MediAssistRover - Theme & Design Tokens
 * Trích xuất chuẩn xác từ Figma Design
 */

export const Colors = {
  // Brand Colors
  primary: '#0284C7',
  primaryLight: '#E0F2FE',
  primaryDark: '#0369A1',

  teal: '#0D9488',
  tealDark: '#0F766E',
  emerald: '#059669',
  emeraldLight: '#D1FAE5',

  // Neutral & Backgrounds
  background: '#F0F7FF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  inputBackground: '#EDF5FD',
  inputBorder: '#E0EDFA',

  // Text Colors
  textPrimary: '#0A2540',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // State Colors
  success: '#059669',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E2EEF9',

  // Stepper
  stepInactive: '#E2E8F0',
  stepInactiveText: '#94A3B8',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: '#0A2540' },
  h2: { fontSize: 20, fontWeight: '700' as const, color: '#0A2540' },
  h3: { fontSize: 16, fontWeight: '600' as const, color: '#0A2540' },
  label: {
    fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8,
    color: '#475569', textTransform: 'uppercase' as const,
  },
  body: { fontSize: 14, fontWeight: '400' as const, color: '#475569' },
  bodySecondary: { fontSize: 13, fontWeight: '400' as const, color: '#64748B' },
  caption: { fontSize: 12, fontWeight: '500' as const, color: '#94A3B8' },
};

export const Shadows = {
  card: {
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07, shadowRadius: 18, elevation: 4,
  },
  button: {
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  floating: {
    shadowColor: '#0A2540', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
  },
};
