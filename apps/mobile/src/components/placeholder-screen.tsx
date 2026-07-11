import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.screenBackground,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  note: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
