import { londonWallClockToUtc, dayOfWeek } from './time';
import {
  PRAYERS,
  type DayTimetable,
  type JumuahTime,
  type NextPrayerInfo,
  type NotificationPrefs,
  type PrayerName,
  type ScheduledAlert,
} from './types';

/** iOS drops pending local notifications beyond 64 per app. */
export const IOS_PENDING_CAP = 64;
/** Head-room so app-badge/test notifications never push prayer alerts over the cap. */
const CAP_SAFETY_MARGIN = 4;

const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: 'Fajr',
  zuhr: 'Zuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

function prayerTimes(day: DayTimetable, prayer: PrayerName): { beginsAt: Date; iqamahAt: Date } {
  return {
    beginsAt: londonWallClockToUtc(day.date, day[`${prayer}_begins`]),
    iqamahAt: londonWallClockToUtc(day.date, day[`${prayer}_iqamah`]),
  };
}

/**
 * The next prayer whose iqamah is strictly in the future, scanning forward
 * across days (so after Isha it rolls over to tomorrow's Fajr).
 * `days` need not be sorted; rows before today are skipped cheaply.
 */
export function getNextPrayer(days: DayTimetable[], now: Date): NextPrayerInfo | null {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const day of sorted) {
    for (const prayer of PRAYERS) {
      const { beginsAt, iqamahAt } = prayerTimes(day, prayer);
      if (iqamahAt.getTime() > now.getTime()) {
        return { prayer, date: day.date, beginsAt, iqamahAt };
      }
    }
  }
  return null;
}

/**
 * Build the rolling local-notification schedule.
 *
 * The window length is DERIVED from how many alerts each day produces, so the
 * result always fits under the iOS 64-pending cap (minus a safety margin) —
 * enabling more alert types shrinks the window instead of silently dropping
 * notifications past the cap (REBUILD_PLAN §4 notification matrix).
 *
 * Only whole days are included: a day either contributes all of its enabled
 * alerts or none, so the last scheduled day is never half-covered.
 */
export function buildNotificationSchedule(
  days: DayTimetable[],
  jumuahTimes: JumuahTime[],
  prefs: NotificationPrefs,
  now: Date,
): ScheduledAlert[] {
  const cap = IOS_PENDING_CAP - CAP_SAFETY_MARGIN;
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const sittings = [...jumuahTimes]
    .filter((j) => j.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const out: ScheduledAlert[] = [];

  for (const day of sorted) {
    const dayAlerts: ScheduledAlert[] = [];

    for (const prayer of PRAYERS) {
      if (!prefs.enabled[prayer]) continue;
      const { iqamahAt } = prayerTimes(day, prayer);
      const fireAt = new Date(iqamahAt.getTime() - prefs.leadMinutes * 60_000);
      if (fireAt.getTime() <= now.getTime()) continue;
      dayAlerts.push({
        id: `${day.date}:${prayer}`,
        date: day.date,
        prayer,
        fireAt,
        iqamahAt,
        title: `${PRAYER_LABEL[prayer]} Iqamah in ${prefs.leadMinutes} minutes`,
        body: `${PRAYER_LABEL[prayer]} iqamah at ${day[`${prayer}_iqamah`].slice(0, 5)} at Wembley Central Masjid.`,
      });
    }

    if (prefs.jumuah !== 'off' && dayOfWeek(day.date) === 5) {
      const wanted =
        prefs.jumuah === 'both' ? sittings
        : prefs.jumuah === 'second' ? sittings.slice(1, 2)
        : sittings.slice(0, 1);
      for (const [i, sitting] of wanted.entries()) {
        const khutbahAt = londonWallClockToUtc(day.date, sitting.khutbah_time);
        const fireAt = new Date(khutbahAt.getTime() - prefs.leadMinutes * 60_000);
        if (fireAt.getTime() <= now.getTime()) continue;
        dayAlerts.push({
          id: `${day.date}:jumuah:${prefs.jumuah === 'second' ? 'second' : i === 0 ? 'first' : 'second'}`,
          date: day.date,
          prayer: 'jumuah',
          fireAt,
          iqamahAt: londonWallClockToUtc(day.date, sitting.iqamah_time),
          title: `Jumu'ah in ${prefs.leadMinutes} minutes`,
          body: `${sitting.label} khutbah at ${sitting.khutbah_time.slice(0, 5)} at Wembley Central Masjid.`,
        });
      }
    }

    if (out.length + dayAlerts.length > cap) break; // whole-day granularity
    out.push(...dayAlerts);
  }

  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return out;
}
