import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Home screen skeleton. The prayer widget below is a static placeholder that
 * M1 replaces with live Supabase data + real countdown (REBUILD_PLAN M1).
 */
export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.prayerWidget}>
        <Text style={styles.widgetTitle}>Salaah Times</Text>
        <Text style={styles.widgetSub}>Live timetable arrives in M1</Text>
        <View style={styles.nextRow}>
          <View>
            <Text style={styles.nextLabel}>Next Iqamah</Text>
            <Text style={styles.nextCountdown}>— —</Text>
          </View>
          <Text style={styles.nextTime}>--:--</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
  prayerWidget: {
    backgroundColor: colors.prayerWidgetBackground,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  widgetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  widgetSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  nextRow: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextLabel: { color: colors.textOnPrimary, fontSize: 12, opacity: 0.9 },
  nextCountdown: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '700' },
  nextTime: { color: colors.textOnPrimary, fontSize: 24, fontWeight: '700' },
});
