const LONDON = 'Europe/London';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** What a given UTC instant reads as on a London wall clock, in ms-since-epoch terms. */
function londonWallMillis(utc: Date): number {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(utc)) p[part.type] = part.value;
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
}

/**
 * Convert a masjid wall-clock time (Europe/London) on a given date to a UTC instant.
 *
 * The timetable stores local times; notifications must fire at the local moment,
 * so this conversion — not the device timezone — is the source of truth.
 * Handles GMT/BST transitions; times inside the spring-forward gap resolve to
 * the post-transition offset (prayer times never fall at 01:xx, so this is moot
 * in practice but keeps the function total).
 */
export function londonWallClockToUtc(dateISO: string, timeHHMM: string): Date {
  const [h = 0, m = 0, s = 0] = timeHHMM.split(':').map(Number);
  const [y = 1970, mo = 1, d = 1] = dateISO.split('-').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, m, s);

  // First guess: treat the wall time as if it were UTC, then correct by the
  // zone offset observed at the guess. London's offset is 0 or +60min, so a
  // second correction pass always converges.
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const diff = londonWallMillis(new Date(guess)) - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** "HH:MM" (or "HH:MM:SS") → minutes since midnight. */
export function timeToMinutes(timeHHMM: string): number {
  const [h = 0, m = 0] = timeHHMM.split(':').map(Number);
  return h * 60 + m;
}

/** Today's date in London as YYYY-MM-DD (device timezone independent). */
export function londonToday(now: Date): string {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(now)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** Day of week (0=Sun..6=Sat) of a YYYY-MM-DD calendar date. */
export function dayOfWeek(dateISO: string): number {
  const [y = 1970, mo = 1, d = 1] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
