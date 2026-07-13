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
  // staff = admin or editor — matches the dashboard's role model; topics are
  // whitelisted below so exposure is bounded either way
  if (role !== 'admin' && role !== 'editor') return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const key = Deno.env.get('ONESIGNAL_REST_API_KEY');

  const { title, message, topic, url, route } = body;
  if (typeof title !== 'string' || !title.trim()) return json({ error: 'title required' }, 400);
  if (typeof message !== 'string' || !message.trim()) return json({ error: 'message required' }, 400);
  if (title.length > 65) return json({ error: 'title too long (max 65 characters)' }, 400);
  if (message.length > 178) return json({ error: 'message too long (max 178 characters)' }, 400);
  if (typeof topic !== 'string' || !(topic in TOPIC_DEFAULT_ON)) return json({ error: 'invalid topic' }, 400);

  // an event deep link must point at a live, published event — otherwise the
  // whole congregation taps into "Event not found"
  if (typeof route === 'string' && route.startsWith('/event/')) {
    const eventId = route.slice('/event/'.length);
    const { data: ev } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('is_published', true)
      .maybeSingle();
    if (!ev) {
      return json({
        ok: false,
        error: 'event_not_found',
        message: 'That event is missing or unpublished — the notification would deep-link to a dead page. Publish the event (or pick another) and try again.',
      }, 400);
    }
  }
  // Scheduling lives in notification_queue now (admin inserts rows directly;
  // the dispatcher sends them) — this function only sends immediately.

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
      ...(typeof url === 'string' && url ? { url } : {}),
      // in-app deep link: the app's notification-click listener navigates here
      ...(typeof route === 'string' && route.startsWith('/') ? { data: { route } } : {}),
    }),
  });
  const result = await resp.json();
  if (resp.ok) {
    // every send leaves a log row — the admin's 30-day audit trail
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const src = body.source === 'prayer_change'
      ? 'prayer_change'
      : body.source === 'event'
        ? 'event'
        : 'composer';
    // "send reminder now" logs against the event so its form shows Sent ✓
    const srcId = src === 'event'
      && typeof body.source_id === 'string'
      && route === `/event/${body.source_id}`
      ? body.source_id
      : null;
    await service.from('notification_queue').insert({
      source: src,
      source_id: srcId,
      title, message, topic,
      route: typeof route === 'string' && route.startsWith('/') ? route : null,
      url: typeof url === 'string' && url && !(typeof route === 'string' && route.startsWith('/')) ? url : null,
      fire_at: new Date().toISOString(),
      status: 'sent',
      sent_at: new Date().toISOString(),
      onesignal_id: result.id ?? null,
      recipients: result.recipients ?? null,
      created_by: user!.id,
    });
  }
  return json(
    {
      ok: resp.ok,
      id: result.id ?? null,
      recipients: result.recipients ?? null,
      errors: result.errors ?? null,
    },
    resp.ok ? 200 : 502,
  );
});
