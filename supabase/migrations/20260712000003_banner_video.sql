-- Media banners: optional video (YouTube link or uploaded file URL)
alter table public.banners add column if not exists video_url text;
