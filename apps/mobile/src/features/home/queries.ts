import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const MEDIA_BASE = 'https://gjffozmcbdtafdsxifyq.supabase.co/storage/v1/object/public/media/';
export function mediaUrl(path: string): string {
  return MEDIA_BASE + path;
}

const bannerSchema = z.object({
  id: z.string(),
  badge: z.string(),
  title: z.string(),
  subtitle: z.string(),
  action_type: z.enum(['screen', 'url', 'none']),
  action_target: z.string().nullable(),
  image_path: z.string().nullable(),
});
export type Banner = z.infer<typeof bannerSchema>;

export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('id,badge,title,subtitle,action_type,action_target,image_path')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => bannerSchema.parse(r));
    },
  });
}

const noticeSchema = z.object({
  id: z.string(),
  icon: z.string(),
  message: z.string(),
  action_type: z.enum(['screen', 'url', 'none']),
  action_target: z.string().nullable(),
});
export type Notice = z.infer<typeof noticeSchema>;

export function useNotices() {
  return useQuery({
    queryKey: ['notices'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notices')
        .select('id,icon,message,action_type,action_target')
        .eq('is_active', true);
      if (error) throw error;
      return data.map((r) => noticeSchema.parse(r));
    },
  });
}

const gallerySchema = z.object({
  id: z.string(),
  storage_path: z.string(),
  caption: z.string().nullable(),
});
export type GalleryImage = z.infer<typeof gallerySchema>;

export function useGallery() {
  return useQuery({
    queryKey: ['gallery'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gallery_images')
        .select('id,storage_path,caption')
        .eq('is_published', true)
        .order('sort_order');
      if (error) throw error;
      return data.map((r) => gallerySchema.parse(r));
    },
  });
}
