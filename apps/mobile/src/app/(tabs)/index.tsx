import { ScrollView, StyleSheet } from 'react-native';

import {
  BannerCarousel,
  MediaStrip,
  NoticeStrip,
  QuickActions,
} from '@/features/home/home-sections';
import { PrayerWidget } from '@/features/prayer-times/prayer-widget';
import { colors } from '@/theme/tokens';

/** Home mirrors the prototype: widget → quick actions → notice → banners.
 *  (Notification onboarding is the first-launch OS prompt — REBUILD_PLAN §4
 *  as amended 13 Jul 2026; the old EnableAlertsCard is gone.) */
export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen}>
      <PrayerWidget />
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
