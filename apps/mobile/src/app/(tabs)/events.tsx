import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenTitle } from '@/components/ui/section-card';
import { useAppConfig } from '@/features/prayer-times/config';
import { useEvents, type WcmEvent } from '@/features/content/queries';
import { colors, radii, spacing } from '@/theme/tokens';

function EventCard({ event }: { event: WcmEvent }) {
  const router = useRouter();
  const d = new Date(event.starts_at);
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit' });
  const month = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', month: 'short' });
  const weekday = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long' });
  const time = event.all_day
    ? 'All Day'
    : d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable
      style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
      onPress={() => router.push(`/event/${event.id}` as never)}
    >
      <View style={styles.dateBox}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.eventDesc} numberOfLines={3}>
            {event.description}
          </Text>
        ) : null}
        <View style={styles.eventTimeRow}>
          <Ionicons name="time-outline" size={13} color={colors.primary} />
          <Text style={styles.eventTime}>
            {weekday} | {time}
          </Text>
        </View>
      </View>
    </Pressable>
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
        <>
        <ScreenTitle>Upcoming Events</ScreenTitle>
        {/* prototype .live-events: green gradient, centred, red LIVE pill */}
        <Pressable
          style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}
          onPress={() => liveUrl && WebBrowser.openBrowserAsync(liveUrl)}
        >
          <LinearGradient
            colors={['#159778', '#0C7058']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={styles.liveTitle}>Watch Live Events</Text>
          <Text style={styles.liveSub}>Streams &amp; broadcasts from the Masjid</Text>
          <Text style={styles.liveCta}>
            {liveUrl ? 'Open live page ' : 'Live events link coming soon'}
            {liveUrl ? <Ionicons name="open-outline" size={11} color="#fff" /> : null}
          </Text>
        </Pressable>
        </>
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
    borderRadius: radii.card,
    overflow: 'hidden',
    padding: 16,
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: 5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    borderRadius: 9999,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 3,
    gap: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  liveTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  liveSub: { fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  liveCta: { fontSize: 12.5, color: '#fff', fontWeight: '600', marginTop: 3 },

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
  // prototype .event-date-box: 50px wide, top-aligned, day 22 / month 11
  dateBox: {
    width: 50,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dateDay: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  dateMonth: { color: colors.textOnPrimary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  eventDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  eventTime: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  spinner: { marginTop: spacing.xl },
  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
