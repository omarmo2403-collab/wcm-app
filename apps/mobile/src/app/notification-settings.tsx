import Stack from 'expo-router/stack';
import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PRAYERS, type PrayerName } from '@wcm/shared';

import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { TOPICS, usePrefs } from '@/features/notifications/prefs';
import {
  getPermissionStatus,
  getScheduledSummary,
  requestPermission,
  sendTestNotification,
  type ScheduledSummary,
} from '@/features/notifications/scheduler';
import { colors, radii, spacing } from '@/theme/tokens';

const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

const LEAD_OPTIONS = [5, 10, 15, 20, 30];
const JUMUAH_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'first', label: '1st' },
  { value: 'second', label: '2nd' },
  { value: 'both', label: 'Both' },
] as const;

export default function NotificationSettingsScreen() {
  const { prefs, topics, setPrayerEnabled, setLeadMinutes, setJumuah, setTopic } = usePrefs();
  const [permission, setPermission] = useState<string>('checking…');
  const [scheduled, setScheduled] = useState<ScheduledSummary[]>([]);

  const refresh = useCallback(async () => {
    setPermission(await getPermissionStatus());
    setScheduled(await getScheduledSummary());
  }, []);

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
        {permission === 'unsupported' && (
          <SectionCard style={styles.first}>
            <Text style={styles.note}>
              Notifications are not available in the web preview — use the mobile app.
            </Text>
          </SectionCard>
        )}

        {permission === 'denied' && (
          <SectionCard style={styles.first}>
            <CardTitle>Notifications are off</CardTitle>
            <Text style={styles.note}>
              Enable notifications for Wembley Central Masjid in your phone settings to receive
              prayer alerts.
            </Text>
            <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
              <Text style={styles.buttonText}>Open phone settings</Text>
            </Pressable>
          </SectionCard>
        )}

        {permission === 'undetermined' && (
          <SectionCard style={styles.first}>
            <CardTitle>Get Adhan &amp; Iqamah alerts</CardTitle>
            <Text style={styles.note}>
              Allow notifications to be reminded {prefs.leadMinutes} minutes before every iqamah.
            </Text>
            <Pressable style={styles.button} onPress={() => requestPermission().then(refresh)}>
              <Text style={styles.buttonText}>Enable notifications</Text>
            </Pressable>
          </SectionCard>
        )}

        <SectionCard style={permission === 'granted' ? styles.first : undefined}>
          <CardTitle>Prayer reminders</CardTitle>
          <Text style={styles.note}>
            Reminders fire {prefs.leadMinutes} minutes before each iqamah.
          </Text>
          {PRAYERS.map((p) => (
            <View key={p} style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{PRAYER_LABEL[p]}</Text>
              <Switch
                value={prefs.enabled[p]}
                onValueChange={(v) => setPrayerEnabled(p, v)}
                trackColor={{ true: colors.primary }}
                accessibilityLabel={`${PRAYER_LABEL[p]} reminder`}
              />
            </View>
          ))}
        </SectionCard>

        <SectionCard>
          <CardTitle>Minutes before iqamah</CardTitle>
          <View style={styles.chipRow}>
            {LEAD_OPTIONS.map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, prefs.leadMinutes === m && styles.chipActive]}
                onPress={() => setLeadMinutes(m)}
              >
                <Text style={[styles.chipText, prefs.leadMinutes === m && styles.chipTextActive]}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <CardTitle>Jumu&apos;ah reminder (Fridays)</CardTitle>
          <View style={styles.chipRow}>
            {JUMUAH_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={[styles.chip, prefs.jumuah === o.value && styles.chipActive]}
                onPress={() => setJumuah(o.value)}
              >
                <Text style={[styles.chipText, prefs.jumuah === o.value && styles.chipTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <CardTitle>Masjid announcements</CardTitle>
          <Text style={styles.note}>
            Messages sent by the Masjid — choose which topics reach you.
          </Text>
          {TOPICS.map((t) => (
            <View key={t.key} style={styles.toggleRow}>
              <View style={styles.topicInfo}>
                <Text style={styles.toggleLabel}>{t.label}</Text>
                <Text style={styles.topicDesc}>{t.desc}</Text>
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

        {permission === 'granted' && (
          <SectionCard>
            <CardTitle>Scheduled on this phone</CardTitle>
            <Text style={styles.note}>
              {scheduled.length} alerts armed
              {next?.fireAt
                ? ` — next: ${next.title.replace(/ in \d+ minutes$/, '')} at ${next.fireAt.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`
                : ''}
            </Text>
            <Pressable style={styles.buttonSecondary} onPress={sendTestNotification}>
              <Text style={styles.buttonSecondaryText}>Send test notification</Text>
            </Pressable>
          </SectionCard>
        )}

        {Platform.OS === 'android' && permission === 'granted' && (
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
  content: { paddingBottom: spacing.xl },
  first: { marginTop: spacing.lg },
  note: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.sm },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  topicInfo: { flex: 1, paddingRight: spacing.md },
  topicDesc: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.textOnPrimary },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  buttonSecondary: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  batteryNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
  },
});
