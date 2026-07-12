-- Home media strip (photos & videos below the banner carousel):
-- gallery_images gains video support and becomes the strip's source.
alter table public.gallery_images add column if not exists video_url text;
