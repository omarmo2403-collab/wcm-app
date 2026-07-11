import { useQuery } from '@tanstack/react-query';
import {
  dayTimetableSchema,
  jumuahTimeSchema,
  londonToday,
  type DayTimetable,
  type JumuahTime,
} from '@wcm/shared';

import { supabase } from '@/lib/supabase';

/** Timetable from today (London) forward — the notification scheduler and widget share this. */
export function usePrayerTimes() {
  return useQuery({
    queryKey: ['prayer_times', londonToday(new Date())],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DayTimetable[]> => {
      const { data, error } = await supabase
        .from('prayer_times')
        .select('*')
        .gte('date', londonToday(new Date()))
        .order('date')
        .limit(60);
      if (error) throw error;
      return data.map((row) => dayTimetableSchema.parse(row));
    },
  });
}

/** Full calendar month for the timetable screen — whatever the admin imported. */
export function useMonthTimetable(month: string) {
  return useQuery({
    queryKey: ['prayer_times_month', month],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DayTimetable[]> => {
      const { data, error } = await supabase
        .from('prayer_times')
        .select('*')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`)
        .order('date');
      if (error) throw error;
      return data.map((row) => dayTimetableSchema.parse(row));
    },
  });
}

export function useJumuahTimes() {
  return useQuery({
    queryKey: ['jumuah_times'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<JumuahTime[]> => {
      const { data, error } = await supabase
        .from('jumuah_times')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((row) => jumuahTimeSchema.parse(row));
    },
  });
}
