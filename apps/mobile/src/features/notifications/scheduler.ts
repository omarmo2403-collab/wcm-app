import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  buildNotificationSchedule,
  type DayTimetable,
  type JumuahTime,
  type NotificationPrefs,
} from '@wcm/shared';

/** ids we own are prefixed so we never cancel anything else */
const ID_PREFIX = 'prayer:';
export const CHANNEL_ID = 'prayer-alerts';

export function notificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

/** Foreground presentation: show alerts even while the app is open. */
export function configureNotificationHandling(): void {
  if (!notificationsSupported()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Prayer alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function getPermissionStatus(): Promise<Notifications.PermissionStatus | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Full permission state — the card needs canAskAgain to decide between
 *  re-prompting and deep-linking to OS settings. */
export async function getPermissionState(): Promise<{
  status: Notifications.PermissionStatus | 'unsupported';
  canAskAgain: boolean;
  granted: boolean;
}> {
  if (!notificationsSupported()) return { status: 'unsupported', canAskAgain: false, granted: false };
  const res = await Notifications.getPermissionsAsync();
  return { status: res.status, canAskAgain: res.canAskAgain, granted: res.status === 'granted' };
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * First-launch / card path. On Android, expo-notifications does NOT reliably
 * report `undetermined` for a never-asked install — it commonly returns
 * `denied` with `canAskAgain: true`. So gating on the status STRING silently
 * skips the request. Gate on capability instead: fire the OS dialog whenever
 * permission isn't already granted AND the OS will still show it. Returns the
 * final granted state. (`canAskAgain: false` = permanently denied → the card
 * deep-links to Settings instead.)
 */
export async function requestPermissionIfPossible(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * The reliability core (REBUILD_PLAN §4): cancel our pending alerts and
 * reschedule from the freshly-fetched timetable. Idempotent, whole-day
 * granularity, capped under iOS's 64-pending limit by buildNotificationSchedule.
 * Called on app start, foreground, and by the daily background task.
 *
 * Runs are SERIALIZED through a module-level chain: a foreground event and a
 * fresh-data effect can both call this at once, and interleaved cancel/
 * schedule loops would let a stale run overwrite corrected iqamah alerts
 * (identical identifiers — last write wins).
 */
let syncChain: Promise<unknown> = Promise.resolve();

export function syncPrayerNotifications(
  days: DayTimetable[],
  jumuah: JumuahTime[],
  prefs: NotificationPrefs,
): Promise<number> {
  const run = syncChain.then(() => doSync(days, jumuah, prefs), () => doSync(days, jumuah, prefs));
  syncChain = run.catch(() => undefined);
  return run;
}

async function doSync(
  days: DayTimetable[],
  jumuah: JumuahTime[],
  prefs: NotificationPrefs,
): Promise<number> {
  if (!notificationsSupported()) return 0;

  // Cancelling needs no permission and MUST happen even when permission is
  // missing: with alerts disabled (or permission revoked) the old alarms
  // would otherwise stay armed in the OS and keep firing.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 0;

  const schedule = buildNotificationSchedule(days, jumuah, prefs, new Date());
  for (const alert of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${alert.id}`,
      content: {
        title: alert.title,
        body: alert.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alert.fireAt,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  }

  // Runway warning: if the timetable ends within 3 days (next month not
  // uploaded yet), tell the user before alerts silently stop.
  const last = schedule[schedule.length - 1];
  if (last && last.fireAt.getTime() - Date.now() < 3 * 24 * 3600 * 1000) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}runway-warning`,
      content: {
        title: 'Prayer alerts pausing soon',
        body: 'The published timetable is ending. Open the app to refresh your prayer alerts.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(last.fireAt.getTime() + 30 * 60 * 1000),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  }
  return schedule.length;
}

/**
 * Lets non-data-holding screens (permission cards, settings) ask the mounted
 * NotificationSync to re-run a full sync — e.g. right after the user grants
 * notification permission, when every earlier sync no-opped.
 */
let resyncListener: (() => void) | null = null;
export function onResyncRequest(fn: (() => void) | null): void {
  resyncListener = fn;
}
export function requestResync(): void {
  resyncListener?.();
}

export interface ScheduledSummary {
  id: string;
  title: string;
  fireAt: Date | null;
}

/** What is actually armed in the OS — the settings screen's "trust but verify" list. */
export async function getScheduledSummary(): Promise<ScheduledSummary[]> {
  if (!notificationsSupported()) return [];
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((n) => n.identifier.startsWith(ID_PREFIX))
    .map((n) => {
      const t = n.trigger as { type?: string; value?: number; date?: number } | null;
      const ms =
        typeof t?.value === 'number' ? t.value : typeof t?.date === 'number' ? t.date : null;
      return {
        id: n.identifier,
        title: n.content.title ?? '',
        fireAt: ms ? new Date(ms) : null,
      };
    })
    .sort((a, b) => (a.fireAt?.getTime() ?? 0) - (b.fireAt?.getTime() ?? 0));
}

export async function sendTestNotification(): Promise<void> {
  if (!notificationsSupported()) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test notification',
      body: 'Prayer alerts from Wembley Central Masjid are working.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
}
