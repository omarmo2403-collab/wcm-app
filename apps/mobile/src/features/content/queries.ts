import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const donationCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  url: z.string(),
  sort_order: z.number(),
});
export type DonationCategory = z.infer<typeof donationCategorySchema>;

export function useDonationCategories() {
  return useQuery({
    queryKey: ['donation_categories'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donation_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => donationCategorySchema.parse(r));
    },
  });
}

const madrasahClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.string(),
  time_range: z.string(),
  sort_order: z.number(),
});
export type MadrasahClass = z.infer<typeof madrasahClassSchema>;

export function useMadrasahClasses() {
  return useQuery({
    queryKey: ['madrasah_classes'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('madrasah_classes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => madrasahClassSchema.parse(r));
    },
  });
}

const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  all_day: z.boolean(),
  category: z.string(),
  location: z.string().nullable(),
});
export type WcmEvent = z.infer<typeof eventSchema>;

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id,title,description,starts_at,ends_at,all_day,category,location')
        .eq('is_published', true)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(50);
      if (error) throw error;
      return data.map((r) => eventSchema.parse(r));
    },
  });
}
