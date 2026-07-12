-- A media item may be a video with no uploaded thumbnail (YouTube provides
-- one) — but it must have SOMETHING to show.
alter table public.gallery_images alter column storage_path drop not null;
alter table public.gallery_images add constraint gallery_media_present
  check (storage_path is not null or video_url is not null);
