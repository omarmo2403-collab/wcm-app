import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PRAYERS, formatHijri, londonToday, type PrayerName } from '@wcm/shared';

import { colors, widget } from '@/theme/tokens';
import { useAppConfig } from './config';
import { useJumuahTimes, usePrayerTimes } from './queries';
import { useNextPrayer } from './use-next-prayer';

const LABEL: Record<PrayerName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

const PRAYER_ICON: Record<PrayerName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  fajr: 'moon-waning-crescent',
  zuhr: 'white-balance-sunny',
  asr: 'weather-partly-cloudy',
  maghrib: 'weather-sunset-down',
  isha: 'weather-night',
};

/** "13:30:00" → "1:30 pm" */
function fmt(time: string): string {
  const [hRaw = 0, m = 0] = time.split(':').map(Number);
  const period = hRaw >= 12 ? 'pm' : 'am';
  const h = hRaw % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

/** "1:30 pm" without the am/pm, for the Jumu'ah "1:30 & 2:15" span */
function fmtShort(time: string): string {
  return fmt(time).replace(/ [ap]m$/, '');
}

function gregorianLong(): string {
  // prototype format: "July 11, 2026"
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'Europe/London',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function monthLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'Europe/London',
    month: 'long',
    year: 'numeric',
  });
}

export function PrayerWidget() {
  const router = useRouter();
  const timetable = usePrayerTimes();
  const jumuah = useJumuahTimes();
  const config = useAppConfig();
  const { next, countdown } = useNextPrayer(timetable.data);

  const today = timetable.data?.find((d) => d.date === londonToday(new Date()));
  const hijriOffset = typeof config.data?.hijri_offset_days === 'number' ? config.data.hijri_offset_days : 0;

  if (timetable.isPending) {
    return (
      <View style={[styles.widget, styles.center]}>
        <ActivityIndicator color={widget.white} />
      </View>
    );
  }

  if (timetable.isError || !today) {
    return (
      <View style={styles.widget}>
        <Text style={styles.title}>Salaah Times</Text>
        <Text style={styles.errorText}>
          {timetable.isError
            ? "Couldn't load the timetable. Please check your connection."
            : "Today's timetable has not been published yet."}
        </Text>
      </View>
    );
  }

  const isCountdownHours = countdown.split(':').length === 3;

  return (
    <View style={styles.widget}>
      {/* title */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Salaah Times</Text>
          <Text style={styles.dateLine}>for {gregorianLong()}</Text>
          <Text style={styles.hijriLine}>{formatHijri(today.date, hijriOffset)}</Text>
        </View>
        <Image
          source={require('../../../assets/brand/salaah_icon.png')}
          style={styles.salaahIcon}
          contentFit="contain"
        />
      </View>

      {/* next prayer */}
      {next && (
        <View style={styles.nextRow}>
          <View>
            <Text style={styles.nextLabel}>
              {LABEL[next.prayer]} Iqamah
            </Text>
            <Text style={styles.countdown}>
              <Text style={styles.countdownValue}>{countdown}</Text>
              {isCountdownHours ? ' Hours' : ' Minutes'}
            </Text>
          </View>
          <Text style={styles.nextTime}>
            {next.date === today.date ? fmt(today[`${next.prayer}_iqamah`]) : fmt(today.fajr_iqamah)}
          </Text>
        </View>
      )}

      {/* timetable */}
      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.nameCell, styles.headCell]}>Prayer</Text>
          <Text style={[styles.timeCell, styles.headCell, styles.headCenter]}>Begins</Text>
          <Text style={[styles.timeCell, styles.headCell, styles.headCenter]}>Iqamah</Text>
        </View>

        <PrayerRow prayer="fajr" today={today} next={next} />
        {/* sunrise sits between Fajr and Zuhr, spanning both time columns */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.nameCell}>
            <MaterialCommunityIcons name="weather-sunset-up" size={20} color={widget.white} style={styles.rowIcon} />
            <Text style={styles.nameText}>Sunrise</Text>
          </View>
          <Text style={[styles.spanCell]}>{fmt(today.sunrise)}</Text>
        </View>
        <PrayerRow prayer="zuhr" today={today} next={next} />
        <PrayerRow prayer="asr" today={today} next={next} />
        <PrayerRow prayer="maghrib" today={today} next={next} />
        <PrayerRow prayer="isha" today={today} next={next} />

        {jumuah.data && jumuah.data.length > 0 && (
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.nameCell}>
              <Image
                source={require('../../../assets/brand/table-icon-4.svg')}
                style={styles.rowImgIcon}
                contentFit="contain"
              />
              <Text style={styles.nameText}>Jumuah</Text>
            </View>
            <Text style={[styles.spanCell, styles.jumuahText]}>
              {jumuah.data.map((j) => fmtShort(j.iqamah_time)).join(' & ')}
            </Text>
          </View>
        )}
      </View>

      {/* monthly timetable button */}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => router.push('/prayer-times')}
      >
        <Image
          source={require('../../../assets/brand/btn-icon.svg')}
          style={styles.buttonIcon}
          contentFit="contain"
        />
        <Text style={styles.buttonLabel}>Prayer Times for {monthLabel()}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={widget.white} />
      </Pressable>
    </View>
  );
}

function PrayerRow({
  prayer,
  today,
  next,
}: {
  prayer: PrayerName;
  today: NonNullable<ReturnType<typeof usePrayerTimes>['data']>[number];
  next: ReturnType<typeof useNextPrayer>['next'];
}) {
  const active = next?.prayer === prayer && next.date === today.date;
  const textStyle = active ? styles.activeText : styles.nameText;
  return (
    <View style={[styles.row, styles.rowBorder, active && styles.activeRow]}>
      <View style={styles.nameCell}>
        <MaterialCommunityIcons
          name={PRAYER_ICON[prayer]}
          size={20}
          color={active ? widget.cream : widget.white}
          style={styles.rowIcon}
        />
        <Text style={[styles.nameText, active && styles.activeText]}>{LABEL[prayer]}</Text>
      </View>
      <Text style={[styles.timeCell, active && styles.activeText]}>
        {fmt(today[`${prayer}_begins`])}
      </Text>
      <Text style={[styles.timeCell, active ? styles.highlightText : undefined]}>
        {fmt(today[`${prayer}_iqamah`])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: widget.background,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 240 },
  errorText: { color: widget.white, fontSize: 14, marginTop: 8, lineHeight: 20 },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: widget.divider,
  },
  title: { fontSize: 22, fontWeight: '700', color: widget.white, lineHeight: 25 },
  dateLine: { fontSize: 15, fontWeight: '600', color: widget.white, marginTop: 4 },
  hijriLine: { fontSize: 15, fontStyle: 'italic', color: widget.white, marginTop: 1 },
  salaahIcon: { width: 56, height: 56 },

  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 4,
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: widget.cream,
    letterSpacing: 0.3,
  },
  countdown: { fontSize: 14, color: widget.cream, marginTop: 2 },
  countdownValue: { fontWeight: '700' },
  nextTime: { fontSize: 34, fontWeight: '400', color: widget.cream },

  table: { borderWidth: 1, borderColor: widget.headerRow },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBorder: { borderTopWidth: 1, borderTopColor: widget.headerRow },
  headRow: { backgroundColor: widget.headerRow },
  headCell: { fontSize: 14, fontWeight: '600', color: widget.white, paddingVertical: 5 },
  headCenter: { textAlign: 'center' },

  nameCell: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rowIcon: { marginRight: 7 },
  rowImgIcon: { width: 20, height: 20, marginRight: 7 },
  nameText: { fontSize: 14, fontWeight: '700', color: widget.white },
  timeCell: {
    flex: 1,
    fontSize: 14,
    color: widget.white,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  spanCell: {
    flex: 2,
    fontSize: 14,
    color: widget.white,
    textAlign: 'center',
    paddingVertical: 6,
  },
  jumuahText: { fontWeight: '400' },

  activeRow: { borderLeftWidth: 2, borderLeftColor: widget.cream },
  activeText: { color: widget.cream, fontSize: 14, fontWeight: '700' },
  highlightText: { color: widget.cream, fontWeight: '700' },

  button: {
    marginTop: 20,
    minHeight: 56,
    borderRadius: 36,
    backgroundColor: widget.buttonBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buttonPressed: { opacity: 0.8 },
  buttonIcon: { width: 18, height: 22 },
  buttonLabel: { fontSize: 14, fontWeight: '700', color: widget.white },
});

// colors import kept for error/loading parity with screen background
void colors;
