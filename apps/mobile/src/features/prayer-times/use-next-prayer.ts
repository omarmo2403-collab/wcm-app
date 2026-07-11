import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getNextPrayer, type DayTimetable, type NextPrayerInfo } from '@wcm/shared';

export interface NextPrayerState {
  next: NextPrayerInfo | null;
  /** e.g. "8:49" (m:ss) or "1:08:12" (h:mm:ss) until iqamah */
  countdown: string;
}

/**
 * Derived, never stored: recomputed every second and on app foreground,
 * so the countdown can never freeze like the prototype's did (REBUILD_PLAN §3.4).
 */
export function useNextPrayer(days: DayTimetable[] | undefined): NextPrayerState {
  const [state, setState] = useState<NextPrayerState>({ next: null, countdown: '' });

  useEffect(() => {
    if (!days || days.length === 0) return;

    const tick = () => {
      const now = new Date();
      const next = getNextPrayer(days, now);
      if (!next) {
        setState({ next: null, countdown: '' });
        return;
      }
      const totalSec = Math.max(0, Math.floor((next.iqamahAt.getTime() - now.getTime()) / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const countdown =
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${m}:${String(s).padStart(2, '0')}`;
      setState({ next, countdown });
    };

    tick();
    const interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [days]);

  return state;
}
