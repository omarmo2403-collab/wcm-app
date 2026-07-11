import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

/** Branded fallback for unmatched routes (e.g. a stale deep link). */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.screen}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.text}>That page doesn&apos;t exist or may have been removed.</Text>
        <Link href="/" style={styles.link}>
          Go to Home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' },
  link: {
    marginTop: spacing.md,
    color: colors.textOnPrimary,
    backgroundColor: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.input,
    overflow: 'hidden',
  },
});
