import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** app_config as a key→value map (hijri_offset_days, live_events_url, …). */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app_config'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.from('app_config').select('key,value');
      if (error) throw error;
      return Object.fromEntries(data.map((row) => [row.key, row.value]));
    },
  });
}
