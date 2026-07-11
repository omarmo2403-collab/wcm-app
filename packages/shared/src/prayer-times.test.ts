import { describe, it, expect } from 'vitest';
import { getNextPrayer, buildNotificationSchedule, IOS_PENDING_CAP } from './prayer-times';
import { DEFAULT_PREFS, type DayTimetable, type JumuahTime } from './types';

/** A plausible July day; maghrib begins == iqamah (as at WCM). */
function day(date: string, overrides: Partial<DayTimetable> = {}): DayTimetable {
  return {
    date,
    fajr_begins: '03:00',
    fajr_iqamah: '04:15',
    sunrise: '04:52',
    zuhr_begins: '13:11',
    zuhr_iqamah: '13:30',
    asr_begins: '18:40',
    asr_iqamah: '19:30',
    maghrib_begins: '21:20',
    maghrib_iqamah: '21:20',
    isha_begins: '22:30',
    isha_iqamah: '22:45',
    ...overrides,
  };
}

/** N consecutive July days starting 2026-07-11 (a Saturday). */
function days(n: number, from = 11): DayTimetable[] {
  return Array.from({ length: n }, (_, i) => day(`2026-07-${String(from + i).padStart(2, '0')}`));
}

const jumuah: JumuahTime[] = [
  { id: '1', label: "First Jumu'ah", khutbah_time: '13:15', iqamah_time: '13:30', sort_order: 1, is_active: true },
  { id: '2', label: "Second Jumu'ah", khutbah_time: '14:00', iqamah_time: '14:15', sort_order: 2, is_active: true },
];

// 2026-07-11 is BST (UTC+1): local 15:00 == 14:00Z.
const at = (iso: string) => new Date(iso);

describe('getNextPrayer', () => {
  it('mid-afternoon → next is asr', () => {
    const next = getNextPrayer(days(3), at('2026-07-11T14:00:00Z')); // 15:00 local
    expect(next?.prayer).toBe('asr');
    expect(next?.date).toBe('2026-07-11');
    expect(next?.iqamahAt.toISOString()).toBe('2026-07-11T18:30:00.000Z'); // 19:30 BST
  });

  it('after isha iqamah → rolls over to tomorrow fajr', () => {
    const next = getNextPrayer(days(3), at('2026-07-11T22:00:00Z')); // 23:00 local
    expect(next?.prayer).toBe('fajr');
    expect(next?.date).toBe('2026-07-12');
  });

  it('exactly at iqamah → that prayer is no longer "next"', () => {
    // asr iqamah 19:30 BST == 18:30Z
    const next = getNextPrayer(days(3), at('2026-07-11T18:30:00Z'));
    expect(next?.prayer).toBe('maghrib');
  });

  it('maghrib begins==iqamah is handled', () => {
    const next = getNextPrayer(days(3), at('2026-07-11T19:00:00Z')); // 20:00 local
    expect(next?.prayer).toBe('maghrib');
    expect(next?.beginsAt.toISOString()).toBe(next?.iqamahAt.toISOString());
  });

  it('between begins and iqamah, prayer still counts as next (countdown to iqamah)', () => {
    // 19:00 local = between asr begins (18:40) and iqamah (19:30)
    const next = getNextPrayer(days(3), at('2026-07-11T18:00:00Z'));
    expect(next?.prayer).toBe('asr');
  });

  it('no timetable data → null', () => {
    expect(getNextPrayer([], at('2026-07-11T14:00:00Z'))).toBeNull();
  });

  it('timetable exhausted (past all days) → null', () => {
    expect(getNextPrayer(days(2), at('2026-08-01T14:00:00Z'))).toBeNull();
  });
});

describe('buildNotificationSchedule', () => {
  const now = at('2026-07-11T00:00:00Z'); // 01:00 local, before fajr

  it('fires leadMinutes before iqamah', () => {
    const sched = buildNotificationSchedule(days(3), jumuah, DEFAULT_PREFS, now);
    const fajr = sched.find((s) => s.id === '2026-07-11:fajr')!;
    // fajr iqamah 04:15 BST == 03:15Z; minus 15 min = 03:00Z
    expect(fajr.fireAt.toISOString()).toBe('2026-07-11T03:00:00.000Z');
  });

  it('skips alerts whose fire time is already past', () => {
    const midDay = at('2026-07-11T14:00:00Z');
    const sched = buildNotificationSchedule(days(3), jumuah, DEFAULT_PREFS, midDay);
    expect(sched.find((s) => s.id === '2026-07-11:fajr')).toBeUndefined();
    expect(sched.find((s) => s.id === '2026-07-11:asr')).toBeDefined();
  });

  it('respects per-prayer toggles', () => {
    const prefs = { ...DEFAULT_PREFS, enabled: { ...DEFAULT_PREFS.enabled, fajr: false } };
    const sched = buildNotificationSchedule(days(3), jumuah, prefs, now);
    expect(sched.some((s) => s.prayer === 'fajr')).toBe(false);
    expect(sched.some((s) => s.prayer === 'zuhr')).toBe(true);
  });

  it("adds a Jumu'ah alert on Fridays only (first sitting by default)", () => {
    // 2026-07-17 is a Friday
    const sched = buildNotificationSchedule(days(10), jumuah, DEFAULT_PREFS, now);
    const jumuahAlerts = sched.filter((s) => s.prayer === 'jumuah');
    expect(jumuahAlerts.map((s) => s.date)).toEqual(['2026-07-17']);
    // khutbah 13:15 BST == 12:15Z; minus 15 = 12:00Z
    expect(jumuahAlerts[0]!.fireAt.toISOString()).toBe('2026-07-17T12:00:00.000Z');
  });

  it("jumuah: 'both' adds two Friday alerts; 'off' adds none", () => {
    const both = buildNotificationSchedule(days(10), jumuah, { ...DEFAULT_PREFS, jumuah: 'both' }, now);
    expect(both.filter((s) => s.prayer === 'jumuah')).toHaveLength(2);
    const off = buildNotificationSchedule(days(10), jumuah, { ...DEFAULT_PREFS, jumuah: 'off' }, now);
    expect(off.filter((s) => s.prayer === 'jumuah')).toHaveLength(0);
  });

  it('never exceeds the iOS pending cap, even with 60 days of data', () => {
    const sched = buildNotificationSchedule(days(20).concat(days(20, 1).map((d, i) => ({ ...d, date: `2026-08-${String(i + 1).padStart(2, '0')}` }))), jumuah, DEFAULT_PREFS, now);
    expect(sched.length).toBeLessThanOrEqual(IOS_PENDING_CAP);
  });

  it('window shrinks when more alert types are enabled (derived, not constant)', () => {
    const fiveADay = buildNotificationSchedule(days(20, 1), jumuah, DEFAULT_PREFS, at('2026-07-01T00:00:00Z'));
    const oneADay = buildNotificationSchedule(
      days(20, 1),
      jumuah,
      { ...DEFAULT_PREFS, jumuah: 'off', enabled: { fajr: true, zuhr: false, asr: false, maghrib: false, isha: false } },
      at('2026-07-01T00:00:00Z'),
    );
    const daysCovered = (s: typeof fiveADay) => new Set(s.map((x) => x.date)).size;
    expect(daysCovered(oneADay)).toBeGreaterThan(daysCovered(fiveADay));
  });

  it('entries are sorted by fire time and only whole days are included', () => {
    const sched = buildNotificationSchedule(days(20), jumuah, DEFAULT_PREFS, now);
    for (let i = 1; i < sched.length; i++) {
      expect(sched[i]!.fireAt.getTime()).toBeGreaterThanOrEqual(sched[i - 1]!.fireAt.getTime());
    }
    // last included day must be complete (all 5 prayers present)
    const lastDate = sched[sched.length - 1]!.date;
    expect(sched.filter((s) => s.date === lastDate && s.prayer !== 'jumuah')).toHaveLength(5);
  });

  it('DST end day (25 Oct 2026): alert fires at correct GMT instant', () => {
    const octDay = day('2026-10-25', {
      fajr_begins: '05:30', fajr_iqamah: '06:15',
    });
    const sched = buildNotificationSchedule([octDay], jumuah, DEFAULT_PREFS, at('2026-10-24T23:00:00Z'));
    const fajr = sched.find((s) => s.id === '2026-10-25:fajr')!;
    // 06:15 GMT (clocks already back) minus 15 = 06:00Z
    expect(fajr.fireAt.toISOString()).toBe('2026-10-25T06:00:00.000Z');
  });
});
