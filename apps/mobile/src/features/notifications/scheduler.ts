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

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * The reliability core (REBUILD_PLAN §4): cancel our pending alerts and
 * reschedule from the freshly-fetched timetable. Idempotent, whole-day
 * granularity, capped under iOS's 64-pending limit by buildNotificationSchedule.
 * Called on app start, foreground, and by the daily background task.
 */
export async function syncPrayerNotifications(
  days: DayTimetable[],
  jumuah: JumuahTime[],
  prefs: NotificationPrefs,
): Promise<number> {
  if (!notificationsSupported()) return 0;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 0;

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

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
  return schedule.length;
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
