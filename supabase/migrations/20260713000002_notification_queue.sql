-- Unified notification queue: single source of truth for every push.
-- Spec: docs/superpowers/specs/2026-07-13-notification-queue-design.md

create table public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('event','stadium','template','composer','prayer_change')),
  source_id     uuid,
  title         text not null check (char_length(title) <= 65),
  message       text not null check (char_length(message) <= 178),
  topic         text not null check (topic in ('prayer_times','events','stadium')),
  route         text check (route is null or route like '/%'),
  url           text,
  fire_at       timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending','sent','failed','canceled','expired')),
  attempts      int not null default 0,
  sent_at       timestamptz,
  onesignal_id  text,
  recipients    int,
  error         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index nq_status_fire_at on public.notification_queue (status, fire_at);
-- one live reminder per event
create unique index nq_one_pending_per_event on public.notification_queue (source_id)
  where source = 'event' and status = 'pending';
-- duplicate-send guard: manual sources only (event reminders may share a
-- minute). fire_at is pinned to UTC in the expression because index
-- expressions must be immutable; the truncated minute is the same instant.
create unique index nq_manual_minute_dedup on public.notification_queue
  (topic, date_trunc('minute', fire_at at time zone 'utc'))
  where status = 'pending' and source in ('stadium','template','composer');

create or replace function public.nq_touch_updated_at()
returns trigger language plpgsql set search_path to '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger nq_touch before update on public.notification_queue
  for each row execute function public.nq_touch_updated_at();

alter table public.notification_queue enable row level security;
create policy nq_staff_read on public.notification_queue
  for select using (public.is_staff());
create policy nq_staff_insert on public.notification_queue
  for insert with check (public.is_staff());
-- staff may only cancel pending rows (never edit content or resurrect)
create policy nq_staff_cancel on public.notification_queue
  for update using (public.is_staff() and status = 'pending')
  with check (public.is_staff() and status = 'canceled');
-- stadium re-upload replaces that month's pending rows
create policy nq_staff_delete_pending on public.notification_queue
  for delete using (public.is_staff() and status = 'pending');

grant select, insert, update, delete on public.notification_queue to authenticated;
grant all on public.notification_queue to service_role;

-- audit (same pattern as other content tables)
create trigger audit_notification_queue
  after insert or delete or update on public.notification_queue
  for each row execute function public.write_audit();

-- Exact push text for an event reminder; single source shared by trigger,
-- backfill and (mirrored in TS) the admin preview.
create or replace function public.compose_event_reminder(ev public.events)
returns table (title text, message text)
language sql stable set search_path to '' as $$
  select
    left(ev.title, 59) || ' today',
    left(
      'Join us '
      || case
           when ev.time_label is not null
             then lower(left(ev.time_label, 1)) || substring(ev.time_label from 2)
           when ev.all_day then 'today'
           else 'at ' || trim(to_char(ev.starts_at at time zone 'Europe/London', 'FMHH12:MI am'))
         end
      || ' at Wembley Central Masjid. Tap for details.',
    178)
$$;

-- Keep each event's queue row in lockstep with the event.
create or replace function public.sync_event_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare c record;
begin
  if tg_op = 'DELETE' then
    update public.notification_queue set status = 'canceled'
      where source = 'event' and source_id = old.id and status = 'pending';
    return old;
  end if;
  if new.is_published and new.notify_at is not null then
    select * into c from public.compose_event_reminder(new);
    update public.notification_queue
       set fire_at = new.notify_at, title = c.title, message = c.message
     where source = 'event' and source_id = new.id and status = 'pending';
    if not found then
      insert into public.notification_queue
        (source, source_id, title, message, topic, route, fire_at, created_by)
      values
        ('event', new.id, c.title, c.message, 'events', '/event/' || new.id, new.notify_at, null);
    end if;
  else
    update public.notification_queue set status = 'canceled'
      where source = 'event' and source_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger event_notification_sync
  after insert or update or delete on public.events
  for each row execute function public.sync_event_notification();

-- Dispatcher claim: expire stale, then hand back everything due.
-- attempts increments per claim; the dispatcher marks failed after 3.
create or replace function public.claim_due_notifications()
returns setof public.notification_queue
language plpgsql security definer set search_path to '' as $$
begin
  update public.notification_queue set status = 'expired'
    where status = 'pending' and fire_at < now() - interval '6 hours';
  return query
    update public.notification_queue
       set attempts = attempts + 1
     where id in (
       select id from public.notification_queue
        where status = 'pending' and fire_at <= now()
        order by fire_at
        for update skip locked)
    returning *;
end $$;
revoke all on function public.claim_due_notifications() from public, anon, authenticated;
grant execute on function public.claim_due_notifications() to service_role;

-- Backfill: published events with a live future-ish reminder
insert into public.notification_queue (source, source_id, title, message, topic, route, fire_at, created_by)
select 'event', e.id, c.title, c.message, 'events', '/event/' || e.id, e.notify_at, null
from public.events e
cross join lateral public.compose_event_reminder(e) c
where e.is_published
  and e.notify_at is not null
  and e.notified_at is null
  and e.notify_at > now() - interval '6 hours';

-- queue status supersedes the old stamp; old dispatcher is unscheduled below,
-- so nothing reads this column any more
alter table public.events drop column if exists notified_at;

-- cron: hourly event-day-push -> 5-minute notification-dispatcher
select cron.unschedule('event-day-push');
select cron.schedule(
  'notification-dispatcher',
  '*/5 * * * *',
  $$select net.http_post(
      url := 'https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/notification-dispatcher',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','SET-AT-DEPLOY-TIME'),
      body := '{}'::jsonb)$$);
