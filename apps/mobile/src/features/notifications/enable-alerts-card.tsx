import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';
import { usePrefs } from './prefs';
import { getPermissionStatus, requestPermission, requestResync } from './scheduler';

/**
 * Soft notification onboarding (REBUILD_PLAN §4): value proposition first,
 * OS permission dialog only on an affirmative tap — never on first launch.
 */
export function EnableAlertsCard() {
  const { promptDismissed, dismissPrompt } = usePrefs();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getPermissionStatus().then((s) => setVisible(s === 'undetermined'));
  }, []);

  if (!visible || promptDismissed) return null;

  return (
    <View style={styles.card}>
      <Ionicons name="notifications" size={22} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.title}>Never miss an iqamah</Text>
        <Text style={styles.text}>Get an alert 15 minutes before every prayer at the Masjid.</Text>
      </View>
      <Pressable
        style={styles.enable}
        onPress={() =>
          requestPermission().then((granted) => {
            setVisible(false);
            // every sync before the grant no-opped — arm the alerts now
            if (granted) requestResync();
          })
        }
      >
        <Text style={styles.enableText}>Enable</Text>
      </Pressable>
      <Pressable onPress={dismissPrompt} hitSlop={8} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBackground,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  text: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  enable: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  enableText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 13 },
});
