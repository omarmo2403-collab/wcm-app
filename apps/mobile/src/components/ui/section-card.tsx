import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

/** White content card used across screens (prototype .section-card) */
export function SectionCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function CardTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
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
});
