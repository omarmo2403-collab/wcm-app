import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useJumuahTimes, usePrayerTimes } from '@/features/prayer-times/queries';
import { initAnalytics, track } from '@/lib/analytics';
import { initOneSignal, syncTopicTags } from '@/lib/onesignal';
import { registerBackgroundSync } from './background';
import { usePrefs } from './prefs';
import { configureNotificationHandling, syncPrayerNotifications } from './scheduler';

/**
 * Invisible component mounted inside the providers: keeps the OS notification
 * schedule in lockstep with the timetable. Re-syncs when data or prefs change
 * and on every app foreground (layer 4 of the reliability chain).
 */
export function NotificationSync() {
  const timetable = usePrayerTimes();
  const jumuah = useJumuahTimes();
  const prefs = usePrefs((s) => s.prefs);
  const topics = usePrefs((s) => s.topics);

  // Init MUST be declared before the tag-sync effect: effects run in
  // declaration order, and OneSignal.User.addTags before initialize() is a
  // fatal native-thread crash (the 21:24 logcat, MIUI, 11 Jul 2026).
  useEffect(() => {
    configureNotificationHandling();
    registerBackgroundSync();
    initOneSignal();
    initAnalytics();
  }, []);

  useEffect(() => {
    syncTopicTags(topics);
  }, [topics]);

  useEffect(() => {
    if (!timetable.data || !jumuah.data) return;
    const days = timetable.data;
    const sittings = jumuah.data;

    syncPrayerNotifications(days, sittings, prefs).then((count) => {
      if (count > 0) track('notifications_rescheduled', { count, first_date: days[0]?.date ?? null });
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        timetable.refetch();
        syncPrayerNotifications(days, sittings, prefs);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable.data, jumuah.data, prefs]);

  return null;
}
