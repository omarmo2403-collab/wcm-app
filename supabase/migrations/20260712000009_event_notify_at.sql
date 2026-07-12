-- Per-event reminder time (replaces the fixed 5pm daily dispatch, which made
-- no sense for morning events). notify_at defaults smartly via trigger:
-- timed events 2h before start; all-day/labelled events 9am UK that day.
-- notified_at stamps sends so the hourly dispatcher is idempotent.
alter table public.events add column if not exists notify_at timestamptz;
alter table public.events add column if not exists notified_at timestamptz;

create or replace function public.default_event_notify_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.notify_at is null then
    if new.all_day or new.time_label is not null then
      -- 09:00 Europe/London on the event's (London) date
      new.notify_at := (((new.starts_at at time zone 'Europe/London')::date)::timestamp
                        + interval '9 hours') at time zone 'Europe/London';
    else
      new.notify_at := new.starts_at - interval '2 hours';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists event_default_notify_at on public.events;
create trigger event_default_notify_at
  before insert on public.events
  for each row execute function public.default_event_notify_at();

-- backfill existing events (stadium excluded — its pushes are scheduled by
-- the Stadium Days importer on the stadium topic)
update public.events
   set notify_at = case
     when all_day or time_label is not null then
       (((starts_at at time zone 'Europe/London')::date)::timestamp
        + interval '9 hours') at time zone 'Europe/London'
     else starts_at - interval '2 hours'
   end
 where notify_at is null and category <> 'stadium';

-- dispatcher now runs hourly (minute 5) instead of once daily
select cron.unschedule('event-day-push');
select cron.schedule(
  'event-day-push',
  '5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/event-day-push',
    headers := jsonb_build_object('x-cron-secret', 'SET-AT-DEPLOY-TIME')
  );
  $cron$
);
