import { router } from 'expo-router';
import { Platform } from 'react-native';

export const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';

/**
 * Remote push (announcements, iqamah-change alerts) — native builds only.
 * Local prayer alerts are handled separately by features/notifications.
 * Topic tag values mirror the 7 notification categories (REBUILD_PLAN §4);
 * the topic-preferences UI arrives with M3 — defaults subscribe everyone
 * to prayer-time changes and announcements.
 */
/** Screens a push is allowed to open — anything else falls back to Home. */
const ROUTE_ALLOWLIST = [/^\/event\/[\w-]+$/, /^\/stadium$/, /^\/prayer-times$/, /^\/news$/, /^\/donate$/];

let initializedAtMs: number | null = null;

export function initOneSignal(): void {
  if (Platform.OS === 'web') return;
  try {
    // require() so the web bundle never touches the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal') as typeof import('react-native-onesignal');
    OneSignal.initialize(ONESIGNAL_APP_ID);
    initializedAtMs = Date.now();
    // NO permission request here: the OS dialog must only appear on an
    // affirmative tap (enable-alerts card / settings). Prompting on first
    // launch burns Android 13's one-shot dialog with zero context — and once
    // denied there, the app can never re-prompt.
    // Deep link: admin pushes may carry data.route ('/event/<id>', '/stadium'
    // …) — navigate there when the user taps the notification.
    OneSignal.Notifications.addEventListener('click', (event: import('react-native-onesignal').NotificationClickEvent) => {
      const route = (event.notification.additionalData as { route?: unknown } | undefined)?.route;
      if (typeof route === 'string' && ROUTE_ALLOWLIST.some((re) => re.test(route))) {
        // small delay so navigation lands after the root layout mounts on cold start
        setTimeout(() => router.push(route as never), 400);
      }
    });
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

function writeTags(topics: Record<string, boolean>): void {
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
}

/**
 * Mount-time reconciliation is delayed past the OneSignal init window (the
 * startup crash lesson); user-driven toggles pass immediate=true — init has
 * long settled by then, and the opt-out must not be lost to a debounce if
 * the user closes the app straight after flipping a switch.
 */
export function syncTopicTags(
  topics: Record<string, boolean>,
  opts: { immediate?: boolean } = {},
): void {
  if (Platform.OS === 'web') return;
  if (pendingSync) clearTimeout(pendingSync);
  // Even "immediate" writes must stay outside the native init window — a user
  // deep-linked into settings could toggle within seconds of a cold start,
  // and an early User access is an uncatchable native crash.
  const sinceInit = initializedAtMs === null ? 0 : Date.now() - initializedAtMs;
  const delay = opts.immediate ? Math.max(0, TAG_SYNC_DELAY_MS - sinceInit) : TAG_SYNC_DELAY_MS;
  if (delay === 0) {
    pendingSync = null;
    writeTags(topics);
    return;
  }
  pendingSync = setTimeout(() => {
    pendingSync = null;
    writeTags(topics);
  }, delay);
}
