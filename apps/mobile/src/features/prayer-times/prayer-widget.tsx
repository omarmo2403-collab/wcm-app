import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PRAYERS, londonToday, type PrayerName } from '@wcm/shared';

import { colors, radii, spacing } from '@/theme/tokens';
import { useJumuahTimes, usePrayerTimes } from './queries';
import { useNextPrayer } from './use-next-prayer';

const LABEL: Record<PrayerName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/** "13:30:00" or "13:30" → "1:30 pm" */
function fmt(time: string): string {
  const [hRaw = 0, m = 0] = time.split(':').map(Number);
  const period = hRaw >= 12 ? 'pm' : 'am';
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function gregorianToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PrayerWidget() {
  const timetable = usePrayerTimes();
  const jumuah = useJumuahTimes();
  const { next, countdown } = useNextPrayer(timetable.data);

  const today = timetable.data?.find((d) => d.date === londonToday(new Date()));

  if (timetable.isPending) {
    return (
      <View style={[styles.widget, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (timetable.isError || !today) {
    return (
      <View style={styles.widget}>
        <Text style={styles.title}>Salaah Times</Text>
        <Text style={styles.sub}>
          {timetable.isError
            ? "Couldn't load the timetable. Pull to refresh or check your connection."
            : "Today's timetable has not been published yet."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.widget}>
      <Text style={styles.title}>Salaah Times</Text>
      <Text style={styles.sub}>for {gregorianToday()}</Text>

      {next && (
        <View style={styles.nextRow}>
          <View>
            <Text style={styles.nextLabel}>{LABEL[next.prayer]} Iqamah</Text>
            <Text style={styles.nextCountdown}>{countdown}</Text>
          </View>
          <Text style={styles.nextTime}>
            {fmt(today.date === next.date ? today[`${next.prayer}_iqamah`] : '')}
          </Text>
        </View>
      )}

      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cell, styles.headCell, styles.nameCell]}>Prayer</Text>
          <Text style={[styles.cell, styles.headCell]}>Begins</Text>
          <Text style={[styles.cell, styles.headCell]}>Iqamah</Text>
        </View>
        {PRAYERS.map((p) => {
          const active = next?.prayer === p && next.date === today.date;
          return (
            <View key={p} style={[styles.row, active && styles.activeRow]}>
              <Text style={[styles.cell, styles.nameCell, active && styles.activeText]}>
                {LABEL[p]}
              </Text>
              <Text style={[styles.cell, active && styles.activeText]}>
                {fmt(today[`${p}_begins`])}
              </Text>
              <Text style={[styles.cell, styles.iqamahCell, active && styles.activeText]}>
                {fmt(today[`${p}_iqamah`])}
              </Text>
            </View>
          );
        })}
        <View style={styles.row}>
          <Text style={[styles.cell, styles.nameCell]}>Sunrise</Text>
          <Text style={styles.cell}>{fmt(today.sunrise)}</Text>
          <Text style={styles.cell} />
        </View>
        {jumuah.data && jumuah.data.length > 0 && (
          <View style={styles.row}>
            <Text style={[styles.cell, styles.nameCell]}>Jumu&apos;ah</Text>
            <Text style={[styles.cell, styles.iqamahCell, styles.jumuahCell]}>
              {jumuah.data.map((j) => fmt(j.iqamah_time).replace(/ [ap]m/, '')).join(' & ')}
            </Text>
            <Text style={styles.cell} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: colors.prayerWidgetBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  nextRow: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextLabel: { color: colors.textOnPrimary, fontSize: 12, opacity: 0.9 },
  nextCountdown: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700' },
  nextTime: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700' },
  table: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headRow: { borderBottomWidth: 1 },
  activeRow: { backgroundColor: colors.prayerWidgetHighlight, borderRadius: radii.input },
  cell: { flex: 1, fontSize: 14, color: colors.text, textAlign: 'center' },
  headCell: { fontWeight: '700', fontSize: 12, color: colors.textSecondary },
  nameCell: { textAlign: 'left', fontWeight: '600' },
  iqamahCell: { fontWeight: '700' },
  jumuahCell: { textAlign: 'center' },
  activeText: { color: colors.primaryPressed, fontWeight: '700' },
});
