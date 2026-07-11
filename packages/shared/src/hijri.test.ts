import { describe, it, expect } from 'vitest';
import { formatHijri } from './hijri';

describe('formatHijri', () => {
  it('matches the masjid website for 11 Jul 2026', () => {
    // wembleycentralmasjid.co.uk showed "26 Muharram 1448" on this date
    expect(formatHijri('2026-07-11')).toBe('26 Muharram 1448');
  });

  it('applies the moon-sighting offset in days', () => {
    expect(formatHijri('2026-07-11', 1)).toBe('27 Muharram 1448');
    expect(formatHijri('2026-07-11', -1)).toBe('25 Muharram 1448');
  });

  it('crosses Hijri month boundaries correctly, in masjid style', () => {
    // 14 Jul 2026 = 29 Muharram; 15 Jul = 1 Safar (per masjid timetable)
    expect(formatHijri('2026-07-14')).toBe('29 Muharram 1448');
    expect(formatHijri('2026-07-15')).toBe('1 Safar 1448');
  });
});
