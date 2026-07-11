import Stack from 'expo-router/stack';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { usePrayerTimes } from '@/features/prayer-times/queries';
import { colors, radii, spacing } from '@/theme/tokens';

function fmtShort(time: string): string {
  const [hRaw = 0, m = 0] = time.split(':').map(Number);
  return `${hRaw % 12 || 12}:${String(m).padStart(2, '0')}`;
}

/** Monthly timetable (M1 basic version — month picker and share arrive later). */
export default function PrayerTimesScreen() {
  const timetable = usePrayerTimes();

  return (
    <>
      <Stack.Screen options={{ title: 'Prayer Times' }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={timetable.data ?? []}
        keyExtractor={(d) => d.date}
        ListHeaderComponent={
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.dateCell, styles.headText]}>Date</Text>
            {['Fajr', 'Zuhr', 'Asr', 'Mag', 'Isha'].map((p) => (
              <Text key={p} style={[styles.cell, styles.headText]}>
                {p}
              </Text>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.dateCell}>
              {new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                weekday: 'short',
              })}
            </Text>
            <Text style={styles.cell}>{fmtShort(item.fajr_iqamah)}</Text>
            <Text style={styles.cell}>{fmtShort(item.zuhr_iqamah)}</Text>
            <Text style={styles.cell}>{fmtShort(item.asr_iqamah)}</Text>
            <Text style={styles.cell}>{fmtShort(item.maghrib_iqamah)}</Text>
            <Text style={styles.cell}>{fmtShort(item.isha_iqamah)}</Text>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headRow: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: radii.input,
    borderTopRightRadius: radii.input,
  },
  headText: { color: colors.textOnPrimary, fontWeight: '700' },
  dateCell: { flex: 1.6, fontSize: 13, color: colors.text },
  cell: { flex: 1, fontSize: 13, color: colors.text, textAlign: 'center' },
});
