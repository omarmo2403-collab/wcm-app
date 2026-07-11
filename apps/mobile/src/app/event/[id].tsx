import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import Stack from 'expo-router/stack';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { CardTitle, SectionCard } from '@/components/ui/section-card';
import { useEvents } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useEvents();
  const event = events.data?.find((e) => e.id === id);
  const [calStatus, setCalStatus] = useState('');

  if (!event) {
    return (
      <>
        <Stack.Screen options={{ title: 'Event' }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Event not found — it may have been removed.</Text>
        </View>
      </>
    );
  }

  const starts = new Date(event.starts_at);
  const when = `${starts.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' })}${
    event.all_day ? ' (all day)' : ` at ${starts.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' })}`
  }`;

  const addToCalendar = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Calendar.createEventInCalendarAsync({
        title: event.title,
        notes: event.description,
        location: event.location ?? 'Wembley Central Masjid, 35-37 Ealing Road, Wembley HA0 4AE',
        startDate: starts,
        endDate: event.ends_at ? new Date(event.ends_at) : new Date(starts.getTime() + 60 * 60 * 1000),
        allDay: event.all_day,
      });
      setCalStatus('Opened in your calendar ✓');
    } catch {
      setCalStatus('Calendar unavailable on this device');
    }
  };

  const share = () =>
    Share.share({
      message: `${event.title} — ${when} at Wembley Central Masjid.\n\n${event.description}`,
    });

  return (
    <>
      <Stack.Screen options={{ title: 'Event' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroDate}>
            {starts.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short' })}
          </Text>
          <Text style={styles.heroTitle}>{event.title}</Text>
          <Text style={styles.heroWhen}>{when}</Text>
        </View>

        <SectionCard>
          <CardTitle>Details</CardTitle>
          <Text style={styles.body}>{event.description || 'No further details.'}</Text>
          {event.location ? <Text style={styles.location}>📍 {event.location}</Text> : null}
        </SectionCard>

        {Platform.OS !== 'web' && (
          <SectionCard>
            <Pressable style={styles.button} onPress={addToCalendar}>
              <Ionicons name="calendar" size={16} color={colors.textOnPrimary} />
              <Text style={styles.buttonText}> Add to calendar</Text>
            </Pressable>
            <Pressable style={styles.buttonSecondary} onPress={share}>
              <Ionicons name="share-social" size={16} color={colors.primary} />
              <Text style={styles.buttonSecondaryText}> Share</Text>
            </Pressable>
            {calStatus ? <Text style={styles.calStatus}>{calStatus}</Text> : null}
          </SectionCard>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textSecondary, fontSize: 14 },
  hero: { backgroundColor: colors.primary, padding: spacing.xl, alignItems: 'center' },
  heroDate: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  heroTitle: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heroWhen: { color: colors.textOnPrimary, opacity: 0.9, fontSize: 13, marginTop: 4, textAlign: 'center' },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  location: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  buttonSecondary: {
    flexDirection: 'row',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  calStatus: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
