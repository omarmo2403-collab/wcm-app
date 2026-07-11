import { ScrollView, StyleSheet } from 'react-native';

import { EnableAlertsCard } from '@/features/notifications/enable-alerts-card';
import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen}>
      {/* widget is full-bleed like the prototype's .time-table section */}
      <PrayerWidget />
      <EnableAlertsCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
});
