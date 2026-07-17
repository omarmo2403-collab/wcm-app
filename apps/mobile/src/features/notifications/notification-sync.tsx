import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useJumuahTimes, usePrayerTimes } from '@/features/prayer-times/queries';
import { initAnalytics, track } from '@/lib/analytics';
import { initOneSignal, syncTopicTags } from '@/lib/onesignal';
import { registerBackgroundSync } from './background';
import { usePrefs } from './prefs';
import {
  configureNotificationHandling,
  onResyncRequest,
  requestPermissionIfPossible,
  requestResync,
  syncPrayerNotifications,
} from './scheduler';

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
    // REBUILD_PLAN §4 (amended 13 Jul 2026): fire the OS permission dialog on
    // first launch. Gate on CAPABILITY, not the status string — on Android a
    // never-asked install reports `denied`+canAskAgain, not `undetermined`, so
    // the old `=== 'undetermined'` gate silently skipped the request and no
    // notifications ever arrived (the make-or-break bug, 16 Jul 2026). The
    // short delay lets Home paint so the dialog doesn't pop over the splash.
    const promptTimer = setTimeout(() => {
      requestPermissionIfPossible().then((granted) => {
        // every sync before the grant no-opped — arm the alerts now
        if (granted) requestResync();
      });
    }, 600);
    return () => clearTimeout(promptTimer);
  }, []);

  useEffect(() => {
    syncTopicTags(topics);
  }, [topics]);

  useEffect(() => {
    if (!timetable.data || !jumuah.data) return;
    const days = timetable.data;
    const sittings = jumuah.data;

    const sync = () =>
      syncPrayerNotifications(days, sittings, prefs)
        .then((count) => {
          if (count > 0) track('notifications_rescheduled', { count, first_date: days[0]?.date ?? null });
        })
        .catch(() => track('notifications_sync_failed', {}));

    sync();

    // permission cards / settings ask for a resync right after a grant —
    // every sync before the grant was a no-op
    onResyncRequest(sync);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        timetable.refetch();
        sync();
      }
    });
    return () => {
      onResyncRequest(null);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable.data, jumuah.data, prefs]);

  return null;
}
