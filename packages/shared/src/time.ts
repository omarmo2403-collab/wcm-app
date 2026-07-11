/**
 * Europe/London time arithmetic without Intl.
 *
 * Hermes (React Native's JS engine) has patchy Intl support on Android and a
 * module-scope Intl failure would crash the app at startup, so the masjid's
 * timezone maths is implemented directly: UK law fixes the transitions at the
 * last Sunday of March and the last Sunday of October, 01:00 UTC.
 */

const HOUR = 3_600_000;

/** UTC instant (ms) of 01:00 UTC on the last Sunday of the given month. */
function lastSundayTransition(year: number, monthIndex: number): number {
  // day 0 of next month = last day of this month
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
  return Date.UTC(year, monthIndex, lastSunday, 1);
}

/** Is this UTC instant inside British Summer Time? */
function isBst(utcMillis: number): boolean {
  const year = new Date(utcMillis).getUTCFullYear();
  return utcMillis >= lastSundayTransition(year, 2) && utcMillis < lastSundayTransition(year, 9);
}

/**
 * Convert a masjid wall-clock time (Europe/London) on a given date to a UTC instant.
 *
 * The timetable stores local times; notifications must fire at the local moment,
 * so this conversion — not the device timezone — is the source of truth.
 * Times inside the spring-forward gap resolve to the post-transition offset
 * (prayer times never fall at 01:xx, so this is moot in practice).
 */
export function londonWallClockToUtc(dateISO: string, timeHHMM: string): Date {
  const [h = 0, m = 0, s = 0] = timeHHMM.split(':').map(Number);
  const [y = 1970, mo = 1, d = 1] = dateISO.split('-').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, m, s); // interpretation if GMT
  const asBst = asUtc - HOUR; //                    interpretation if BST
  return new Date(isBst(asBst) ? asBst : asUtc);
}

/** "HH:MM" (or "HH:MM:SS") → minutes since midnight. */
export function timeToMinutes(timeHHMM: string): number {
  const [h = 0, m = 0] = timeHHMM.split(':').map(Number);
  return h * 60 + m;
}

/** London date parts for a UTC instant. */
export function londonDateParts(now: Date): { year: number; month: number; day: number } {
  const shifted = new Date(now.getTime() + (isBst(now.getTime()) ? HOUR : 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Today's date in London as YYYY-MM-DD (device timezone independent). */
export function londonToday(now: Date): string {
  const { year, month, day } = londonDateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Day of week (0=Sun..6=Sat) of a YYYY-MM-DD calendar date. */
export function dayOfWeek(dateISO: string): number {
  const [y = 1970, mo = 1, d = 1] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "July 11, 2026" — prototype's date format, no Intl. */
export function formatLondonDateLong(now: Date): string {
  const { year, month, day } = londonDateParts(now);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/** "July 2026" */
export function formatLondonMonthYear(now: Date): string {
  const { year, month } = londonDateParts(now);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
