import { createClient } from 'npm:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '36591c9d-0098-4d2b-bad5-d240719d9285';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Exactly three user-facing topics (simplified 12 Jul 2026). All opt-out:
// devices that never wrote tags (fresh installs) are included; only an
// explicit tag 'false' (set by the in-app switch) excludes them.
const TOPIC_DEFAULT_ON: Record<string, boolean> = {
  prayer_times: true,
  events: true,
  stadium: true,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Caller must be a signed-in staff user with the admin role —
  // the OneSignal key never leaves this function.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata as Record<string, unknown> | undefined)?.app_role;
  if (role !== 'admin') return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const key = Deno.env.get('ONESIGNAL_REST_API_KEY');

  // action: 'list_scheduled' — pending (scheduled, not yet sent) notifications
  if (body.action === 'list_scheduled') {
    const resp = await fetch(
      `https://api.onesignal.com/notifications?app_id=${ONESIGNAL_APP_ID}&limit=50&kind=1`,
      { headers: { Authorization: `Key ${key}` } },
    );
    const result = await resp.json();
    const now = Date.now() / 1000;
    const scheduled = (result.notifications ?? [])
      .filter((n: { send_after?: number; completed_at?: number | null; canceled?: boolean }) =>
        !n.canceled && !n.completed_at && (n.send_after ?? 0) > now)
      .map((n: Record<string, unknown>) => ({
        id: n.id,
        title: (n.headings as Record<string, string>)?.en ?? '',
        message: (n.contents as Record<string, string>)?.en ?? '',
        send_after: n.send_after,
      }));
    return json({ ok: resp.ok, scheduled }, resp.ok ? 200 : 502);
  }

  // action: 'cancel' — cancel a scheduled notification by id
  if (body.action === 'cancel') {
    if (typeof body.id !== 'string' || !body.id) return json({ error: 'id required' }, 400);
    const resp = await fetch(
      `https://api.onesignal.com/notifications/${body.id}?app_id=${ONESIGNAL_APP_ID}`,
      { method: 'DELETE', headers: { Authorization: `Key ${key}` } },
    );
    const result = await resp.json();
    return json({ ok: resp.ok, ...result }, resp.ok ? 200 : 502);
  }

  const { title, message, topic, url, send_after } = body;
  if (typeof title !== 'string' || !title.trim()) return json({ error: 'title required' }, 400);
  if (typeof message !== 'string' || !message.trim()) return json({ error: 'message required' }, 400);
  if (typeof topic !== 'string' || !(topic in TOPIC_DEFAULT_ON)) return json({ error: 'invalid topic' }, 400);
  // optional scheduling: ISO instant, must be in the future (max ~1 year out)
  let sendAfter: string | null = null;
  if (send_after != null) {
    const t = Date.parse(String(send_after));
    if (Number.isNaN(t)) return json({ error: 'invalid send_after' }, 400);
    if (t < Date.now() + 60_000) return json({ error: 'send_after must be in the future' }, 400);
    if (t > Date.now() + 366 * 24 * 3600 * 1000) return json({ error: 'send_after too far ahead' }, 400);
    sendAfter = new Date(t).toISOString();
  }

  // Opt-out topics also reach devices that never wrote tags; explicit
  // tag 'false' (set by the in-app toggle) excludes them.
  const filters = TOPIC_DEFAULT_ON[topic]
    ? [
        { field: 'tag', key: topic, relation: '=', value: 'true' },
        { operator: 'OR' },
        { field: 'tag', key: topic, relation: 'not_exists' },
      ]
    : [{ field: 'tag', key: topic, relation: '=', value: 'true' }];

  const resp = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message },
      filters,
      ...(sendAfter ? { send_after: sendAfter } : {}),
      ...(typeof url === 'string' && url ? { url } : {}),
    }),
  });
  const result = await resp.json();
  return json(
    {
      ok: resp.ok,
      id: result.id ?? null,
      recipients: result.recipients ?? null,
      scheduled_for: sendAfter,
      errors: result.errors ?? null,
    },
    resp.ok ? 200 : 502,
  );
});
