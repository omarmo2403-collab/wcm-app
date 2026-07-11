import { describe, it, expect } from 'vitest';
import { londonWallClockToUtc } from './time';

// UK 2026: BST starts Sun 29 Mar 01:00, ends Sun 25 Oct 02:00.

describe('londonWallClockToUtc', () => {
  it('winter (GMT): wall clock equals UTC', () => {
    expect(londonWallClockToUtc('2026-01-15', '13:30').toISOString()).toBe(
      '2026-01-15T13:30:00.000Z',
    );
  });

  it('summer (BST): wall clock is UTC+1', () => {
    expect(londonWallClockToUtc('2026-07-11', '19:30').toISOString()).toBe(
      '2026-07-11T18:30:00.000Z',
    );
  });

  it('DST start day (29 Mar 2026): time after the spring-forward gap uses BST', () => {
    // 05:00 local on the changeover day is unambiguous BST → 04:00Z
    expect(londonWallClockToUtc('2026-03-29', '05:00').toISOString()).toBe(
      '2026-03-29T04:00:00.000Z',
    );
  });

  it('DST start day: time before 01:00 is still GMT', () => {
    expect(londonWallClockToUtc('2026-03-29', '00:30').toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
  });

  it('DST end day (25 Oct 2026): morning after fall-back is GMT', () => {
    // 06:15 local after clocks went back → 06:15Z
    expect(londonWallClockToUtc('2026-10-25', '06:15').toISOString()).toBe(
      '2026-10-25T06:15:00.000Z',
    );
  });

  it('DST end day: evening prayer times are GMT', () => {
    expect(londonWallClockToUtc('2026-10-25', '16:45').toISOString()).toBe(
      '2026-10-25T16:45:00.000Z',
    );
  });

  it('day before DST end is still BST', () => {
    expect(londonWallClockToUtc('2026-10-24', '16:45').toISOString()).toBe(
      '2026-10-24T15:45:00.000Z',
    );
  });

  it('accepts HH:MM:SS times (as Postgres returns them)', () => {
    expect(londonWallClockToUtc('2026-01-15', '13:30:00').toISOString()).toBe(
      '2026-01-15T13:30:00.000Z',
    );
  });
});
