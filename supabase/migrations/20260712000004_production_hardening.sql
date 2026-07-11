-- Production hardening from the 12 Jul 2026 deep audit.

-- Backstop against blank-cell imports: a prayer_times row whose core times are
-- all midnight is always an import/editor bug, never real data. (The admin UI
-- now refuses to save incomplete days; this catches any other write path.)
alter table public.prayer_times add constraint prayer_times_not_all_midnight
  check (not (fajr_begins = '00:00' and zuhr_begins = '00:00' and isha_begins = '00:00'));

-- Atomic stadium-month replace: the admin previously deleted a month's stadium
-- days and inserted the new set as two requests — a failure in between left
-- the month empty. One transaction; SECURITY INVOKER so RLS still gates it to
-- staff and the events audit triggers still fire.
create or replace function public.replace_stadium_days(windows jsonb, days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w jsonb;
begin
  for w in select * from jsonb_array_elements(windows) loop
    delete from public.events
     where category = 'stadium'
       and starts_at >= (w->>'from')::timestamptz
       and starts_at <  (w->>'to')::timestamptz;
  end loop;
  insert into public.events (title, description, starts_at, all_day, category, is_published)
  select d->>'title', d->>'description', (d->>'starts_at')::timestamptz, true, 'stadium', true
    from jsonb_array_elements(days) as d;
end;
$$;
revoke execute on function public.replace_stadium_days(jsonb, jsonb) from public, anon;
grant execute on function public.replace_stadium_days(jsonb, jsonb) to authenticated;

-- jumuah_times was the only writable table without an audit trigger.
create trigger audit_jumuah_times
  after insert or update or delete on public.jumuah_times
  for each row execute function public.write_audit();

-- Server-side limits on the public media bucket (client checks are advisory).
update storage.buckets
   set file_size_limit = 52428800, -- 50 MB
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'
       ]
 where id = 'media';

-- Remove the default-privileges footgun: future tables no longer become
-- anon-readable (or authenticated-writable) unless a migration grants it
-- explicitly. Existing tables keep their existing grants.
alter default privileges in schema public revoke select on tables from anon;
alter default privileges in schema public revoke select, insert, update, delete on tables from authenticated;

-- Hot-path indexes: upcoming published events (mobile home/events/stadium)
-- and the audit-log listing.
create index if not exists events_published_upcoming
  on public.events (starts_at) where is_published;
create index if not exists audit_log_created_at
  on public.audit_log (created_at desc);

-- Standard hardening: pin search_path on the SECURITY DEFINER audit functions.
alter function public.write_audit() set search_path = '';
alter function public.write_audit_prayer_times() set search_path = '';
alter function public.write_audit_app_config() set search_path = '';
