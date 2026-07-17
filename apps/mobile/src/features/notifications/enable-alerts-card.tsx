import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';
import { getPermissionState, requestPermissionIfPossible, requestResync } from './scheduler';

/**
 * Recovery net (NOT the primary ask — that's the first-launch OS dialog in
 * NotificationSync). Appears ONLY while notifications are off, so a user who
 * granted them never sees it. Covers the cases where the OS dialog can't help:
 * the user tapped "Don't allow", or an OEM (MIUI/Xiaomi) left notifications
 * disabled. Tapping Enable re-prompts if the OS still allows it, otherwise
 * deep-links to the app's notification settings.
 */
export function EnableAlertsCard() {
  // undefined = still checking (render nothing to avoid a flash)
  const [state, setState] = useState<{ granted: boolean; canAskAgain: boolean } | undefined>();

  useEffect(() => {
    let alive = true;
    const check = () =>
      getPermissionState().then((s) => {
        if (alive) setState({ granted: s.granted, canAskAgain: s.canAskAgain });
      });
    check();
    // the user may enable notifications in OS settings and swipe back — re-check
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (!state || state.granted) return null;

  const onEnable = async () => {
    if (state.canAskAgain) {
      const granted = await requestPermissionIfPossible();
      if (granted) {
        requestResync();
        setState({ granted: true, canAskAgain: false });
        return;
      }
    }
    // permanently denied (or the re-prompt was declined) — send them to settings
    Linking.openSettings();
  };

  return (
    <View style={styles.card}>
      <Ionicons name="notifications-off" size={22} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.title}>Turn on notifications</Text>
        <Text style={styles.text}>
          You won&apos;t get prayer reminders or Masjid alerts until notifications are on.
        </Text>
      </View>
      <Pressable style={styles.enable} onPress={onEnable} accessibilityRole="button">
        <Text style={styles.enableText}>Enable</Text>
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
