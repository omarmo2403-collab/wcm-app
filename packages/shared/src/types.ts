import { z } from 'zod';

export const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One row of the masjid's authoritative timetable, as stored in Supabase. */
export const dayTimetableSchema = z.object({
  date: isoDate,
  fajr_begins: time,
  fajr_iqamah: time,
  sunrise: time,
  zuhr_begins: time,
  zuhr_iqamah: time,
  asr_begins: time,
  asr_iqamah: time,
  maghrib_begins: time,
  maghrib_iqamah: time,
  isha_begins: time,
  isha_iqamah: time,
  suhoor_ends: time.nullable().optional(),
  iftar: time.nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type DayTimetable = z.infer<typeof dayTimetableSchema>;

export const jumuahTimeSchema = z.object({
  id: z.string(),
  label: z.string(),
  khutbah_time: time,
  iqamah_time: time,
  sort_order: z.number(),
  is_active: z.boolean(),
});
export type JumuahTime = z.infer<typeof jumuahTimeSchema>;

export interface NotificationPrefs {
  /** per-prayer on/off for the iqamah reminder */
  enabled: Record<PrayerName, boolean>;
  /** minutes before iqamah to fire (default 15) */
  leadMinutes: number;
  /** which Friday Jumu'ah sitting(s) to remind for */
  jumuah: 'first' | 'second' | 'both' | 'off';
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: { fajr: true, zuhr: true, asr: true, maghrib: true, isha: true },
  leadMinutes: 15,
  jumuah: 'first',
};

export interface ScheduledAlert {
  /** stable id so re-scheduling can diff: e.g. "2026-07-11:asr" or "2026-07-17:jumuah:first" */
  id: string;
  date: string;
  prayer: PrayerName | 'jumuah';
  /** UTC instant the notification fires (leadMinutes before iqamah) */
  fireAt: Date;
  /** UTC instant of the iqamah itself */
  iqamahAt: Date;
  title: string;
  body: string;
}

export interface NextPrayerInfo {
  prayer: PrayerName;
  date: string;
  /** UTC instants */
  beginsAt: Date;
  iqamahAt: Date;
}
