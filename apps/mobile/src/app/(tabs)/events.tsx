import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppConfig } from '@/features/prayer-times/config';
import { useEvents, type WcmEvent } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

function EventCard({ event }: { event: WcmEvent }) {
  const d = new Date(event.starts_at);
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit' });
  const month = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', month: 'short' });
  const weekday = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long' });
  const time = event.all_day
    ? 'All Day'
    : d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.eventCard}>
      <View style={styles.dateBox}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.description ? <Text style={styles.eventDesc}>{event.description}</Text> : null}
        <View style={styles.eventTimeRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.eventTime}>
            {weekday} | {time}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const events = useEvents();
  const config = useAppConfig();
  const liveUrl = typeof config.data?.live_events_url === 'string' ? config.data.live_events_url : null;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={events.data ?? []}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <Pressable
          style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}
          onPress={() => liveUrl && WebBrowser.openBrowserAsync(liveUrl)}
        >
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
          <Text style={styles.liveTitle}>Watch Live Events</Text>
          <Text style={styles.liveSub}>Streams &amp; broadcasts from the Masjid</Text>
          <Text style={styles.liveCta}>
            {liveUrl ? 'Open live page ' : 'Live events link coming soon'}
            {liveUrl ? <Ionicons name="open-outline" size={12} color={colors.primary} /> : null}
          </Text>
        </Pressable>
      }
      ListEmptyComponent={
        events.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No upcoming events yet</Text>
            <Text style={styles.emptyText}>
              Events published by the Masjid will appear here.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => <EventCard event={item} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  pressed: { opacity: 0.85 },

  liveCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E74C3C' },
  liveBadgeText: { color: '#E74C3C', fontSize: 12, fontWeight: '700' },
  liveTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  liveSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  liveCta: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },

  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  dateBox: {
    width: 54,
    height: 58,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  dateMonth: { color: colors.textOnPrimary, fontSize: 12, textTransform: 'uppercase' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  eventDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  eventTime: { fontSize: 12, color: colors.textMuted },

  spinner: { marginTop: spacing.xl },
  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
