import uq from '@umalqura/core';

/**
 * Hijri date string for a London calendar date, e.g. "26 Muharram 1448".
 *
 * `offsetDays` is the admin-controlled moon-sighting adjustment from app_config
 * (REBUILD_PLAN §3.3): the Umm al-Qura calendar can disagree with UK sighting
 * announcements by ±1 day, and Ramadan/Eid dates are the masjid's call.
 */
export function formatHijri(dateISO: string, offsetDays = 0): string {
  const [y = 1970, m = 1, d = 1] = dateISO.split('-').map(Number);
  // noon UTC keeps the date stable regardless of host timezone
  const date = new Date(Date.UTC(y, m - 1, d, 12) + offsetDays * 86_400_000);
  // masjid style: unpadded day, plain-ASCII month names ("Safar", not "Ṣafar").
  // Combining-mark escape range instead of \p{Diacritic}: Hermes-safe.
  return uq(date)
    .format('d MMMM yyyy', 'en')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}
