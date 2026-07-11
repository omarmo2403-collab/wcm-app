import { ScrollView, StyleSheet } from 'react-native';

import {
  BannerCarousel,
  NoticeStrip,
  QuickActions,
} from '@/features/home/home-sections';
import { EnableAlertsCard } from '@/features/notifications/enable-alerts-card';
import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors } from '@/theme/tokens';

/** Home mirrors the prototype: widget → quick actions → notice → banners → gallery */
export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen}>
      <PrayerWidget />
      <EnableAlertsCard />
      <QuickActions />
      <NoticeStrip />
      <BannerCarousel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
});
