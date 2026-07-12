-- Free-text time/venue label for events ("After Maghrib Salah",
-- "Behind the main Masjid hall"). When set, the app shows it instead of a
-- clock time or "All Day".
alter table public.events add column if not exists time_label text;
