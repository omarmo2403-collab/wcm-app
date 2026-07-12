import { createClient } from 'npm:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';

/**
 * Hourly event-reminder dispatcher (pg_cron, minute 5): sends a push for
 * every published event whose reminder time (events.notify_at — defaulted to
 * 2h before start, or 9am UK for all-day events, admin-overridable) has
 * arrived and which hasn't been notified yet. notified_at stamps make it
 * idempotent. Server-side because OneSignal cannot schedule >30 days ahead.
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

  const now = new Date();
  const { data: events, error } = await supabase
    .from('events')
    .select('id,title,time_label,all_day,starts_at')
    .eq('is_published', true)
    .neq('category', 'stadium')
    .is('notified_at', null)
    .lte('notify_at', now.toISOString())
    // never notify for events already well in the past (e.g. old rows)
    .gte('starts_at', new Date(now.getTime() - 6 * 3600 * 1000).toISOString());
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
    if (resp.ok) {
      await supabase.from('events').update({ notified_at: now.toISOString() }).eq('id', ev.id);
    }
    results.push({ event: ev.title, ok: resp.ok, id: out.id ?? null });
  }
  return new Response(JSON.stringify({ ok: true, sent: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
