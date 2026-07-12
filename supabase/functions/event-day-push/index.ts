import { createClient } from 'npm:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';

/**
 * Daily event-day dispatcher (invoked by pg_cron at 16:00 UTC ≈ 17:00 UK):
 * sends one push per PUBLISHED event happening today (Europe/London), deep-
 * linked to the event page. Runs server-side forever — unlike OneSignal
 * send_after, which caps scheduling at ~30 days, this covers a whole season
 * of recurring lectures with zero staff effort.
 *
 * Stadium-day events are skipped: the Stadium Days importer schedules those
 * on the stadium topic with the /stadium deep link already.
 */
Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { data: events, error } = await supabase
    .from('events')
    .select('id,title,time_label,all_day,starts_at')
    .eq('is_published', true)
    .neq('category', 'stadium')
    .gte('starts_at', `${today}T00:00:00+01:00`)
    .lt('starts_at', `${today}T23:59:59+01:00`);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const key = Deno.env.get('ONESIGNAL_REST_API_KEY');
  const results: unknown[] = [];
  for (const ev of events ?? []) {
    const when = ev.time_label
      ? ev.time_label.charAt(0).toLowerCase() + ev.time_label.slice(1)
      : ev.all_day
        ? 'today'
        : `at ${new Date(ev.starts_at).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' })}`;
    const resp = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: `${ev.title} today` },
        contents: { en: `Join us ${when} at Wembley Central Masjid. Tap for details.` },
        filters: [
          { field: 'tag', key: 'events', relation: '=', value: 'true' },
          { operator: 'OR' },
          { field: 'tag', key: 'events', relation: 'not_exists' },
        ],
        data: { route: `/event/${ev.id}` },
      }),
    });
    const out = await resp.json().catch(() => ({}));
    results.push({ event: ev.title, ok: resp.ok, id: out.id ?? null });
  }
  return new Response(JSON.stringify({ ok: true, date: today, sent: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
