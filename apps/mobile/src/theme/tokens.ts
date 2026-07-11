/**
 * WCM design tokens, ported 1:1 from prototype/style.css (:root variables)
 * which in turn match wembleycentralmasjid.co.uk. Semantic names so a future
 * dark theme is a token-file change, not a refactor (REBUILD_PLAN §4).
 */
export const palette = {
  green: '#159778',
  greenDark: '#0C7058',
  greenDarker: '#326E59',
  purple: '#914BA1',
  cream: '#FCF7EE',
  creamHalf: 'rgba(236, 216, 180, 0.5)',
  greyBg: '#EFF0F5',
  white: '#FFFFFF',
  black: '#000000',
  text: '#333333',
  textLight: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
} as const;

export const colors = {
  primary: palette.green,
  primaryPressed: palette.greenDark,
  accent: palette.purple,
  screenBackground: palette.greyBg,
  cardBackground: palette.white,
  prayerWidgetBackground: palette.cream,
  text: palette.text,
  textSecondary: palette.textLight,
  textMuted: palette.textMuted,
  textOnPrimary: palette.white,
  border: palette.border,
  tabActive: palette.green,
  tabInactive: palette.textMuted,
} as const;

export const radii = {
  card: 12,
  input: 8,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const typography = {
  /** ProximaNova is the brand font on web; system stack until fonts are licensed for app use */
  heading: { fontWeight: '700' as const },
  body: { fontWeight: '400' as const, fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
} as const;
