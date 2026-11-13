/**
 * MediAssistRover - Theme & Design Tokens
 * Thiết kế chuẩn theo phong cách ảnh tham chiếu:
 * - Nền xám sáng #F3F3F1
 * - Card trắng #FFFFFF bo góc lớn 20dp, border 1dp #E4E4E7
 * - Hero & Dock đen than #202022
 * - Accent xanh lá #24A148 / cam #92400E / đỏ khẩn cấp #C62828
 */

export const Colors = {
  // Brand & Action
  hero: '#202022',
  primaryAction: '#202022',
  navigationDock: '#202022',
  darkRaised: '#2D2D31',
  primary: '#202022', // Primary action button theo phong cách đen sang trọng
  primaryBrand: '#0284C7', // Màu nhấn y tế khi cần phân biệt liên kết/tuyến đường
  primaryLight: '#E0F2FE',
  primaryDark: '#0369A1',

  teal: '#0D9488',
  tealDark: '#0F766E',
  emerald: '#166534',
  emeraldLight: '#EAF6EC',

  // Neutral & Backgrounds
  background: '#F3F3F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F7F5',
  surfaceSubtle: '#F7F7F5',
  inputBackground: '#FFFFFF',
  inputBorder: '#E4E4E7',
  border: '#E4E4E7',

  // Text Colors
  textPrimary: '#1C1C1E',
  textSecondary: '#606068',
  textMuted: '#6B6B73',
  textInverse: '#FFFFFF',
  textInverseSecondary: '#D0D0D5',

  // Status & Semantics
  success: '#166534',
  successText: '#166534',
  successSurface: '#EAF6EC',
  progressAccent: '#24A148',

  warning: '#92400E',
  warningText: '#92400E',
  warningSurface: '#FFF4DE',

  danger: '#C62828',
  dangerSurface: '#FFF0F0',
  error: '#C62828',

  mapRoute: '#2563EB',

  // Stepper
  stepInactive: '#E4E4E7',
  stepInactiveText: '#6B6B73',
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
  lg: 16,
  card: 20,
  hero: 24,
  xl: 24,
  pill: 999,
  full: 9999,
};

export const Typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, color: '#1C1C1E' },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, color: '#1C1C1E' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, color: '#1C1C1E' },
  h3: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, color: '#1C1C1E' },
  label: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600' as const,
    color: '#606068',
    letterSpacing: 0.2,
  },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, color: '#1C1C1E' },
  bodySecondary: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const, color: '#606068' },
  field: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const, color: '#1C1C1E' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const, color: '#6B6B73' },
  helper: { fontSize: 13, lineHeight: 19, fontWeight: '400' as const, color: '#606068' },
};

export const Shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  hero: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dock: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};
