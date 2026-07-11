import { ScrollView, StyleSheet } from 'react-native';

import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen}>
      {/* widget is full-bleed like the prototype's .time-table section */}
      <PrayerWidget />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
});
