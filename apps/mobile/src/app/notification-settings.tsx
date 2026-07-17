import { Ionicons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenTitle, SectionCard, CardTitle } from '@/components/ui/section-card';
import { TOPICS, usePrefs } from '@/features/notifications/prefs';
import {
  getPermissionState,
  getScheduledSummary,
  requestPermissionIfPossible,
  requestResync,
  sendTestNotification,
  type ScheduledSummary,
} from '@/features/notifications/scheduler';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Simplified per Omar (12 Jul 2026): exactly three switches. Prayer Times is
 * a master switch for local iqamah alerts AND remote prayer-time pushes;
 * Events and Stadium control the matching admin push topics.
 */
export default function NotificationSettingsScreen() {
  const { topics, setTopic } = usePrefs();
  const [perm, setPerm] = useState<{ granted: boolean; canAskAgain: boolean }>();
  const [scheduled, setScheduled] = useState<ScheduledSummary[]>([]);

  const refresh = useCallback(async () => {
    const s = await getPermissionState();
    setPerm({ granted: s.granted, canAskAgain: s.canAskAgain });
    setScheduled(await getScheduledSummary());
  }, []);

  const enable = useCallback(async () => {
    const granted = await requestPermissionIfPossible();
    if (granted) requestResync();
    else if (perm && !perm.canAskAgain) Linking.openSettings();
    refresh();
  }, [perm, refresh]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000); // reflect rescheduling as toggles change
    return () => clearInterval(t);
  }, [refresh]);

  const next = scheduled[0];

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle>Push Notifications</ScreenTitle>

        {perm && !perm.granted && (
          <SectionCard style={styles.cardFlush}>
            <CardTitle>Turn on notifications</CardTitle>
            <Text style={styles.note}>
              {perm.canAskAgain
                ? 'Allow notifications to be reminded 15 minutes before every iqamah, and to get Masjid alerts.'
                : 'Notifications are off. Enable them for Wembley Central Masjid in your phone settings to receive alerts.'}
            </Text>
            <Pressable style={styles.button} onPress={enable}>
              <Text style={styles.buttonText}>
                {perm.canAskAgain ? 'Enable notifications' : 'Open phone settings'}
              </Text>
            </Pressable>
          </SectionCard>
        )}

        <SectionCard style={styles.cardFlush}>
          <Text style={styles.note}>
            Choose which notifications you&apos;d like to receive on your phone.
          </Text>
        </SectionCard>

        <SectionCard style={styles.cardFlush}>
          {TOPICS.map((t, i) => (
            <View key={t.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={[styles.iconWrap, { backgroundColor: `${t.color}1A` }]}>
                <Ionicons name={t.icon} size={18} color={t.color} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{t.label}</Text>
                <Text style={styles.rowDesc}>{t.desc}</Text>
              </View>
              <Switch
                value={topics[t.key]}
                onValueChange={(v) => setTopic(t.key, v)}
                trackColor={{ true: colors.primary }}
                accessibilityLabel={t.label}
              />
            </View>
          ))}
        </SectionCard>

        {perm?.granted && topics.prayer_times && (
          <SectionCard style={styles.cardFlush}>
            <CardTitle>Scheduled on this phone</CardTitle>
            <Text style={styles.note}>
              {scheduled.length} prayer alerts armed
              {next?.fireAt
                ? ` — next: ${next.title.replace(/ in \d+ minutes$/, '')} at ${next.fireAt.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`
                : ''}
            </Text>
            <Pressable style={styles.buttonSecondary} onPress={sendTestNotification}>
              <Text style={styles.buttonSecondaryText}>Send test notification</Text>
            </Pressable>
          </SectionCard>
        )}

        {Platform.OS === 'android' && perm?.granted && (
          <Text style={styles.batteryNote}>
            Tip: if alerts arrive late, exclude this app from battery optimisation in your phone
            settings.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg, paddingTop: spacing.sm },
  cardFlush: { marginHorizontal: 0, marginTop: spacing.sm },
  note: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#EFF0F5' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 1, lineHeight: 16 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '700' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.input,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: spacing.md,
  },
  buttonSecondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  batteryNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    lineHeight: 17,
  },
});
