import { Ionicons } from '@expo/vector-icons';
import Stack from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatHijri, londonToday } from '@wcm/shared';

import { useAppConfig } from '@/features/prayer-times/config';
import { useMonthTimetable } from '@/features/prayer-times/queries';
import { colors, radii, spacing } from '@/theme/tokens';

/** "13:30" -> "1:30 pm" (website style) */
function fmt(time: string): string {
  const [hRaw = 0, m = 0] = time.split(':').map(Number);
  const period = hRaw >= 12 ? 'pm' : 'am';
  return `${hRaw % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** column widths (px) — Date wider, times uniform */
const W_DATE = 92;
const W_DAY = 40;
const W_TIME = 66;

const GROUPS: { label: string; cols: number }[] = [
  { label: 'Fajr', cols: 2 },
  { label: '', cols: 1 },
  { label: 'Zuhr', cols: 2 },
  { label: 'Asr', cols: 2 },
  { label: 'Maghrib', cols: 2 },
  { label: 'Isha', cols: 2 },
];
const SUBHEAD = ['Begins', 'Iqamah', 'Sunrise', 'Begins', 'Iqamah', 'Begins', 'Iqamah', 'Begins', 'Iqamah', 'Begins', 'Iqamah'];

/** Monthly timetable mirroring the Masjid website's table — fed entirely by
 *  the month the admin imported from the committee document. */
export default function PrayerTimesScreen() {
  const [month, setMonth] = useState(londonToday(new Date()).slice(0, 7));
  const timetable = useMonthTimetable(month);
  const config = useAppConfig();
  const hijriOffset =
    typeof config.data?.hijri_offset_days === 'number' ? config.data.hijri_offset_days : 0;
  const today = londonToday(new Date());

  return (
    <>
      <Stack.Screen options={{ title: 'Prayer Times' }} />
      <View style={styles.screen}>
        {/* month navigation */}
        <View style={styles.monthBar}>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => addMonths(m, -1))}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable
            hitSlop={12}
            onPress={() => setMonth((m) => addMonths(m, 1))}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {timetable.isPending && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
        {timetable.isError && (
          <Text style={styles.empty}>
            Couldn&apos;t load the timetable — check your connection and try again.
          </Text>
        )}
        {!timetable.isPending && !timetable.isError && (timetable.data?.length ?? 0) === 0 && (
          <Text style={styles.empty}>
            No timetable published for {monthLabel(month)} yet.
          </Text>
        )}

        {(timetable.data?.length ?? 0) > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tableWrap}>
              <View style={styles.table}>
                {/* group header */}
                <View style={styles.row}>
                  <View style={[styles.groupCell, { width: W_DATE + W_DAY }]} />
                  {GROUPS.map((g, i) => (
                    <View
                      key={i}
                      style={[styles.groupCell, styles.groupTop, { width: g.cols * W_TIME }]}
                    >
                      <Text style={styles.groupText}>{g.label}</Text>
                    </View>
                  ))}
                </View>
                {/* sub header */}
                <View style={[styles.row, styles.headRow]}>
                  <Text style={[styles.headCell, { width: W_DATE }]}>Date</Text>
                  <Text style={[styles.headCell, { width: W_DAY }]}>Day</Text>
                  {SUBHEAD.map((h, i) => (
                    <Text key={i} style={[styles.headCell, { width: W_TIME }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {/* days */}
                {timetable.data!.map((d) => {
                  const dt = new Date(`${d.date}T12:00:00Z`);
                  const dow = dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
                  const weekend = dow === 'Sat' || dow === 'Sun';
                  const isToday = d.date === today;
                  return (
                    <View key={d.date} style={[styles.row, styles.dayRow, isToday && styles.todayRow]}>
                      <View style={[styles.dateCell, { width: W_DATE }]}>
                        <Text style={styles.dateText}>
                          {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                        </Text>
                        <Text style={styles.hijriText}>{formatHijri(d.date, hijriOffset)}</Text>
                      </View>
                      <Text style={[styles.dayCell, { width: W_DAY }, weekend && styles.weekend]}>
                        {dow}
                      </Text>
                      {[
                        d.fajr_begins, d.fajr_iqamah, d.sunrise,
                        d.zuhr_begins, d.zuhr_iqamah,
                        d.asr_begins, d.asr_iqamah,
                        d.maghrib_begins, d.maghrib_iqamah,
                        d.isha_begins, d.isha_iqamah,
                      ].map((t, i) => (
                        <Text key={i} style={[styles.timeCell, { width: W_TIME }]}>
                          {fmt(t)}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  spinner: { marginTop: spacing.xl },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.textSecondary, fontSize: 14 },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: spacing.md,
  },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 130, textAlign: 'center' },

  tableWrap: { paddingBottom: spacing.xl },
  table: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.cardBackground,
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row' },
  groupCell: { paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  groupTop: { borderLeftWidth: 1, borderLeftColor: colors.border },
  groupText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  headRow: { backgroundColor: colors.primary },
  headCell: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
    textAlign: 'center',
    paddingVertical: 7,
  },
  dayRow: { borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  todayRow: { backgroundColor: 'rgba(21,151,120,0.08)' },
  dateCell: { paddingVertical: 6, paddingHorizontal: 6 },
  dateText: { fontSize: 12, fontWeight: '700', color: colors.text },
  hijriText: { fontSize: 10.5, fontStyle: 'italic', color: colors.textMuted, marginTop: 1 },
  dayCell: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  weekend: { color: '#C0392B' },
  timeCell: { fontSize: 12, color: colors.text, textAlign: 'center', paddingVertical: 6 },
});
