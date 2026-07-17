import { ScrollView, StyleSheet } from 'react-native';

import {
  BannerCarousel,
  MediaStrip,
  NoticeStrip,
  QuickActions,
} from '@/features/home/home-sections';
import { EnableAlertsCard } from '@/features/notifications/enable-alerts-card';
import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors } from '@/theme/tokens';

/** Home mirrors the prototype: widget → quick actions → notice → banners.
 *  The first-launch OS dialog is the primary permission ask (NotificationSync);
 *  EnableAlertsCard is the recovery net that shows only while alerts are off. */
export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen}>
      <PrayerWidget />
      <EnableAlertsCard />
      <QuickActions />
      <NoticeStrip />
      <BannerCarousel />
      <MediaStrip />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBackground },
});
