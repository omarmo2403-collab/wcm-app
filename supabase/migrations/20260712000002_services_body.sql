-- Long-form service page content (from wembleycentralmasjid.co.uk service pages)
alter table public.services add column if not exists body text not null default '';
