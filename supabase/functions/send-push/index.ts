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

// true = opt-out topic: devices that never wrote tags (fresh installs) are
// included; only an explicit tag 'false' excludes them. false = opt-in
// (madrasah): only devices that explicitly tagged 'true' receive it.
const TOPIC_DEFAULT_ON: Record<string, boolean> = {
  prayer_times: true,
  jumuah: true,
  events: true,
  donations: true,
  madrasah: false,
  announcements: true,
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

  const { title, message, topic, url } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || !title.trim()) return json({ error: 'title required' }, 400);
  if (typeof message !== 'string' || !message.trim()) return json({ error: 'message required' }, 400);
  if (typeof topic !== 'string' || !(topic in TOPIC_DEFAULT_ON)) return json({ error: 'invalid topic' }, 400);

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
      Authorization: `Key ${Deno.env.get('ONESIGNAL_REST_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message },
      filters,
      ...(typeof url === 'string' && url ? { url } : {}),
    }),
  });
  const result = await resp.json();
  return json(
    { ok: resp.ok, id: result.id ?? null, recipients: result.recipients ?? null, errors: result.errors ?? null },
    resp.ok ? 200 : 502,
  );
});
