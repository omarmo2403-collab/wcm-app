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
    // Android 13+ shows the system permission dialog; earlier versions and
    // already-granted devices resolve silently. Safe here: it queues on the
    // native module thread AFTER initialize.
    OneSignal.Notifications.requestPermission(false);
  } catch {
    // module not present (e.g. Expo Go) — remote push simply unavailable
  }
}

/** Mirror the user's topic preferences onto OneSignal tags — the admin push
 *  composer targets `tag topic = 'true'`, so removing a tag opts the user out.
 *
 *  CRASH GUARD: OneSignal's User accessor throws a NATIVE-thread
 *  IllegalStateException ("Must call 'initWithContext' before use") if touched
 *  before initialization settles — uncatchable from JS and it kills the app
 *  (seen on MIUI, 11 Jul 2026). Tag work is therefore delayed well past the
 *  init window and never runs during startup.
 */
const TAG_SYNC_DELAY_MS = 5_000;
let pendingSync: ReturnType<typeof setTimeout> | null = null;

export function syncTopicTags(topics: Record<string, boolean>): void {
  if (Platform.OS === 'web') return;
  if (pendingSync) clearTimeout(pendingSync);
  pendingSync = setTimeout(() => {
    pendingSync = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OneSignal } = require('react-native-onesignal') as typeof import('react-native-onesignal');
      // Explicit 'false' (never tag removal): the send function treats
      // missing tags as subscribed for default-on topics, so opt-out must
      // be a real value.
      const tags = Object.fromEntries(
        Object.entries(topics).map(([k, v]) => [k, v ? 'true' : 'false']),
      );
      OneSignal.User.addTags(tags);
    } catch {
      /* remote push unavailable */
    }
  }, TAG_SYNC_DELAY_MS);
}
