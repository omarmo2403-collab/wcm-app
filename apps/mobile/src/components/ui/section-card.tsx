import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

/** White content card used across screens (prototype .section-card) */
export function SectionCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function CardTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

/** In-content screen heading (prototype .screen-title-bar h2: 22/700 dark) */
export function ScreenTitle({ children }: { children: string }) {
  return <Text style={styles.screenTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // parent containers provide horizontal padding
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
});
