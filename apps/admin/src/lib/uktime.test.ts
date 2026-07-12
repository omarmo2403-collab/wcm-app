import { describe, expect, it } from 'vitest';

import { formatUk, isoToUkInput, ukToIso } from './uktime';

describe('uktime (viewer-timezone independent: all via Intl Europe/London)', () => {
  it('converts UK summer wall clock to UTC (BST, +1)', () => {
    expect(ukToIso('2026-07-13', '20:53')).toBe('2026-07-13T19:53:00.000Z');
  });
  it('converts UK winter wall clock to UTC (GMT, +0)', () => {
    expect(ukToIso('2026-01-13', '09:00')).toBe('2026-01-13T09:00:00.000Z');
  });
  it('round-trips ISO to a UK datetime-local value (summer)', () => {
    expect(isoToUkInput('2026-07-13T19:53:00.000Z')).toBe('2026-07-13T20:53');
  });
  it('round-trips ISO to a UK datetime-local value (winter)', () => {
    expect(isoToUkInput('2026-01-13T09:00:00.000Z')).toBe('2026-01-13T09:00');
  });
  it('returns empty for null/invalid', () => {
    expect(isoToUkInput(null)).toBe('');
    expect(isoToUkInput('nonsense')).toBe('');
  });
  it('formats display time in UK regardless of machine timezone', () => {
    expect(formatUk('2026-07-13T19:53:00.000Z')).toBe('Mon 13 Jul, 8:53 pm');
    expect(formatUk(1784322780)).toBe(formatUk(new Date(1784322780 * 1000).toISOString()));
  });
});
