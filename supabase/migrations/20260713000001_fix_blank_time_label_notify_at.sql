-- Fix: an empty-string time_label (as saved by the admin form when the field
-- is left blank) passed the `time_label is not null` check, so timed events
-- were mis-classified as "labelled" and got the 09:00 reminder default
-- instead of 2 hours before start.

create or replace function public.default_event_notify_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- normalise blank labels away so every downstream check sees null
  new.time_label := nullif(trim(new.time_label), '');
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

-- normalise blank labels already stored
update public.events
set time_label = null
where time_label is not null and trim(time_label) = '';

-- re-derive notify_at for future, un-notified timed events that received the
-- 9am default by mistake; exact-match on the wrong default value so genuine
-- admin-chosen reminder times are left untouched
update public.events
set notify_at = starts_at - interval '2 hours'
where notified_at is null
  and starts_at > now()
  and all_day = false
  and time_label is null
  and notify_at = (((starts_at at time zone 'Europe/London')::date)::timestamp
                   + interval '9 hours') at time zone 'Europe/London';
