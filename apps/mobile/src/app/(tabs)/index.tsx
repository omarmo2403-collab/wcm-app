import { ScrollView, StyleSheet } from 'react-native';

import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PrayerWidget />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
  content: { padding: spacing.lg },
});
