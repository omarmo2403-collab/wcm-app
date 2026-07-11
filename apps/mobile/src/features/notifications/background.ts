import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { dayTimetableSchema, jumuahTimeSchema, londonToday } from '@wcm/shared';

import { supabase } from '@/lib/supabase';
import { notificationsSupported, syncPrayerNotifications } from './scheduler';
import { usePrefs } from './prefs';

export const TIMETABLE_SYNC_TASK = 'wcm-timetable-sync';

/**
 * Layer 3 of the iqamah-change reliability chain (REBUILD_PLAN §4):
 * an opportunistic daily background re-fetch + reschedule that catches
 * devices the silent push missed. Defined at module scope as TaskManager requires.
 */
TaskManager.defineTask(TIMETABLE_SYNC_TASK, async () => {
  try {
    const [times, jumuah] = await Promise.all([
      supabase.from('prayer_times').select('*').gte('date', londonToday(new Date())).order('date').limit(60),
      supabase.from('jumuah_times').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (times.error || jumuah.error) return BackgroundTask.BackgroundTaskResult.Failed;

    const prefs = usePrefs.getState().prefs;
    await syncPrayerNotifications(
      times.data.map((r) => dayTimetableSchema.parse(r)),
      jumuah.data.map((r) => jumuahTimeSchema.parse(r)),
      prefs,
    );
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    await BackgroundTask.registerTaskAsync(TIMETABLE_SYNC_TASK, {
      minimumInterval: 60 * 12, // minutes — roughly twice a day, OS-scheduled
    });
  } catch {
    // background tasks unavailable (e.g. simulator restrictions) — foreground sync still covers us
  }
}
