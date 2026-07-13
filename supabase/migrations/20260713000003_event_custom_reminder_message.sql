-- Per-event custom reminder message: events.notify_message overrides the
-- composed "Join us ... at Wembley Central Masjid" template when set.
-- Blank/whitespace counts as absent (same lesson as time_label).

alter table public.events add column notify_message text;

create or replace function public.compose_event_reminder(ev public.events)
returns table (title text, message text)
language sql stable set search_path to '' as $$
  select
    left(ev.title, 59) || ' today',
    coalesce(
      left(nullif(trim(ev.notify_message), ''), 178),
      left(
        'Join us '
        || case
             when nullif(trim(ev.time_label), '') is not null
               then lower(left(trim(ev.time_label), 1)) || substring(trim(ev.time_label) from 2)
             when ev.all_day then 'today'
             else 'at ' || trim(to_char(ev.starts_at at time zone 'Europe/London', 'FMHH12:MI am'))
           end
        || ' at Wembley Central Masjid. Tap for details.',
      178)
    )
$$;

-- the sync trigger recomposes on every event update, so pending queue rows
-- pick the override up automatically; nothing else to change
