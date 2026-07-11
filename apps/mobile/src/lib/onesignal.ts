import { Platform } from 'react-native';

export const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';

/**
 * Remote push (announcements, iqamah-change alerts) — native builds only.
 * Local prayer alerts are handled separately by features/notifications.
 * Topic tag values mirror the 7 notification categories (REBUILD_PLAN §4);
 * the topic-preferences UI arrives with M3 — defaults subscribe everyone
 * to prayer-time changes and announcements.
 */
export function initOneSignal(): void {
  if (Platform.OS === 'web') return;
  try {
    // require() so the web bundle never touches the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal') as typeof import('react-native-onesignal');
    OneSignal.initialize(ONESIGNAL_APP_ID);
    OneSignal.User.addTags({
      prayer_times: 'true',
      announcements: 'true',
      events: 'true',
    });
  } catch {
    // module not present (e.g. Expo Go) — remote push simply unavailable
  }
}
