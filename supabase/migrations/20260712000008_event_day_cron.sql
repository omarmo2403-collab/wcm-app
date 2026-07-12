-- Daily event-day notification dispatcher: pg_cron calls the event-day-push
-- edge function at 16:00 UTC (~17:00 UK) every day. It notifies for that
-- day's published events — OneSignal cannot schedule further than ~30 days
-- ahead, so recurring programmes are dispatched server-side instead.
-- NOTE: applied to production with the real secret (matches the function's
-- CRON_SECRET). This committed copy is sanitized.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'event-day-push',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/event-day-push',
    headers := jsonb_build_object('x-cron-secret', 'SET-AT-DEPLOY-TIME')
  );
  $$
);
