import { createClient } from 'npm:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';
const MAX_ATTEMPTS = 3;

/**
 * The one notification dispatcher (pg_cron, every 5 minutes): sends every
 * pending notification_queue row whose fire_at has arrived, stamps
 * sent/failed, and prunes the 30-day log. claim_due_notifications() expires
 * rows older than 6h so an outage can never flood the congregation.
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

  const { data: due, error } = await supabase.rpc('claim_due_notifications');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const key = Deno.env.get('ONESIGNAL_REST_API_KEY');
  let sent = 0;
  let failed = 0;
  for (const row of due ?? []) {
    if (row.attempts > MAX_ATTEMPTS) {
      await supabase.from('notification_queue')
        .update({ status: 'failed', error: `gave up after ${row.attempts - 1} attempts` })
        .eq('id', row.id);
      failed++;
      continue;
    }
    const resp = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: row.title },
        contents: { en: row.message },
        filters: [
          { field: 'tag', key: row.topic, relation: '=', value: 'true' },
          { operator: 'OR' },
          { field: 'tag', key: row.topic, relation: 'not_exists' },
        ],
        ...(row.route ? { data: { route: row.route } } : {}),
        ...(row.url && !row.route ? { url: row.url } : {}),
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (resp.ok && out.id) {
      await supabase.from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          onesignal_id: out.id,
          recipients: out.recipients ?? null,
          error: null,
        })
        .eq('id', row.id);
      sent++;
    } else {
      // stays pending (retried next runs) until MAX_ATTEMPTS exceeded
      await supabase.from('notification_queue')
        .update({ error: JSON.stringify(out.errors ?? out).slice(0, 500) })
        .eq('id', row.id);
      failed++;
    }
  }

  // rolling 30-day log
  await supabase.from('notification_queue')
    .delete()
    .neq('status', 'pending')
    .lt('fire_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

  return new Response(
    JSON.stringify({ ok: true, claimed: due?.length ?? 0, sent, failed }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
