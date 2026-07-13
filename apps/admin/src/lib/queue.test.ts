import { describe, expect, it } from 'vitest';

import { composeEventReminder } from './queue';

describe('composeEventReminder mirrors compose_event_reminder (SQL)', () => {
  it('timed event: clock time in UK', () => {
    expect(composeEventReminder({
      title: 'test event', starts_at: '2026-07-13T21:53:00Z', all_day: false, time_label: null,
    })).toEqual({
      title: 'test event today',
      message: 'Join us at 10:53 pm at Wembley Central Masjid. Tap for details.',
    });
  });
  it('labelled event: lower-cased label wins over all_day', () => {
    expect(composeEventReminder({
      title: 'Urdu Seerah', starts_at: '2026-07-13T11:00:00Z', all_day: true, time_label: 'After Maghrib Salah',
    }).message).toBe('Join us after Maghrib Salah at Wembley Central Masjid. Tap for details.');
  });
  it('all-day without label: "today"; long titles clamp to 65', () => {
    expect(composeEventReminder({
      title: 'x'.repeat(80), starts_at: '2026-07-13T11:00:00Z', all_day: true, time_label: null,
    }).title.length).toBeLessThanOrEqual(65);
  });
  it('custom message overrides the template; blank falls back', () => {
    const ev = {
      title: 'Urdu Seerah', starts_at: '2026-07-13T11:00:00Z', all_day: true,
      time_label: 'After Maghrib Salah',
    };
    expect(composeEventReminder({
      ...ev, notify_message: "Tonight's lecture is moved to the main hall",
    }).message).toBe("Tonight's lecture is moved to the main hall");
    expect(composeEventReminder({ ...ev, notify_message: '   ' }).message)
      .toBe('Join us after Maghrib Salah at Wembley Central Masjid. Tap for details.');
  });
});
