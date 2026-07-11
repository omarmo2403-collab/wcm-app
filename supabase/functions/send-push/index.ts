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

  // Fetch ALL pending (scheduled, not yet sent) notifications with audience
  // topic and tap destination. Used by list_scheduled and by the
  // duplicate-schedule guard on new sends.
  async function fetchPending(): Promise<Record<string, unknown>[] | null> {
    const all: Record<string, unknown>[] = [];
    // The list is newest-created-first and includes already-sent items, so
    // long-ago-created scheduled sends sit deep in it — page far enough that
    // a season of stadium days plus months of history still fits.
    for (let offset = 0; offset < 1000; offset += 50) {
      const resp = await fetch(
        `https://api.onesignal.com/notifications?app_id=${ONESIGNAL_APP_ID}&limit=50&offset=${offset}&kind=1`,
        { headers: { Authorization: `Key ${key}` } },
      );
      if (!resp.ok) return null;
      const result = await resp.json().catch(() => null);
      if (result === null) return null;
      const batch = (result.notifications ?? []) as Record<string, unknown>[];
      all.push(...batch);
      if (batch.length < 50) break;
    }
    const now = Date.now() / 1000;
    return all
      .filter((n) =>
        !n.canceled && !n.completed_at && ((n.send_after as number | undefined) ?? 0) > now)
      .map((n) => {
        const filters = (n.filters ?? []) as { field?: string; key?: string }[];
        return {
          id: n.id,
          title: (n.headings as Record<string, string>)?.en ?? '',
          message: (n.contents as Record<string, string>)?.en ?? '',
          send_after: n.send_after,
          topic: filters.find((f) => f.field === 'tag')?.key ?? null,
          url: (n.url as string | undefined) ?? null,
          route: ((n.data as Record<string, unknown>)?.route as string | undefined) ?? null,
        };
      });
  }

  if (body.action === 'list_scheduled') {
    const scheduled = await fetchPending();
    if (scheduled === null) return json({ ok: false, errors: 'could not reach OneSignal' }, 502);
    return json({ ok: true, scheduled });
  }

  // action: 'cancel' — cancel a scheduled notification by id
  if (body.action === 'cancel') {
    if (typeof body.id !== 'string' || !body.id) return json({ error: 'id required' }, 400);
    const resp = await fetch(
      `https://api.onesignal.com/notifications/${body.id}?app_id=${ONESIGNAL_APP_ID}`,
      { method: 'DELETE', headers: { Authorization: `Key ${key}` } },
    );
    const result = await resp.json().catch(() => ({}));
    return json({ ok: resp.ok, ...result }, resp.ok ? 200 : 502);
  }

  const { title, message, topic, url, route, send_after } = body;
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
  // optional scheduling: ISO instant, must be in the future (max ~1 year out)
  let sendAfter: string | null = null;
  if (send_after != null) {
    const t = Date.parse(String(send_after));
    if (Number.isNaN(t)) return json({ error: 'invalid send_after' }, 400);
    if (t < Date.now() + 60_000) return json({ error: 'send_after must be in the future' }, 400);
    if (t > Date.now() + 366 * 24 * 3600 * 1000) return json({ error: 'send_after too far ahead' }, 400);
    sendAfter = new Date(t).toISOString();

    // duplicate guard: refuse a second notification to the SAME topic in the
    // SAME minute — catches the same schedule being uploaded twice, or two
    // sections (composer / template / stadium import) booking the same slot
    const pending = await fetchPending();
    if (pending === null) return json({ ok: false, errors: 'could not reach OneSignal' }, 502);
    const targetMinute = Math.floor(t / 60_000);
    const dup = pending.find((n) =>
      n.topic === topic && Math.floor(((n.send_after as number) * 1000) / 60_000) === targetMinute);
    if (dup) {
      return json({
        ok: false,
        error: 'duplicate_scheduled',
        message: `Already scheduled: "${dup.title}" goes to the same audience (${topic}) at that exact time. Cancel it in Scheduled Notifications first if you want to replace it.`,
      }, 409);
    }
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
      // in-app deep link: the app's notification-click listener navigates here
      ...(typeof route === 'string' && route.startsWith('/') ? { data: { route } } : {}),
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
