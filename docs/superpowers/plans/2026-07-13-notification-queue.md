# Unified Notification Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `notification_queue` table becomes the single source of truth for every push (pending + 30-day sent log); OneSignal holds no schedules; the admin shows and controls everything in UK time.

**Architecture:** A Postgres table + event-sync trigger own all schedules. One edge function (`notification-dispatcher`, pg_cron every 5 min) sends due rows immediately via OneSignal and stamps outcomes. `send-push` shrinks to immediate-send + log. Admin sections write queue rows directly under RLS; a new Notifications section reads the queue.

**Tech Stack:** Supabase (Postgres 15, RLS, pg_cron, Deno edge functions), OneSignal REST, React 19 + Vite admin SPA, vitest.

**Spec:** `docs/superpowers/specs/2026-07-13-notification-queue-design.md` (approved 13 Jul 2026).

## Global Constraints

- Project ref `gjffozmcbdtafdsxifyq`; OneSignal app id `36591c9d-0098-4d2b-bad5-d240719d9285`.
- Apply SQL to the live DB via `POST https://api.supabase.com/v1/projects/gjffozmcbdtafdsxifyq/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN` (token in env; body `{"query": "<sql>"}`). Committed migration files keep the cron secret as the literal `SET-AT-DEPLOY-TIME`; when applying live, substitute the real secret (recover it with `select command from cron.job where jobname = 'event-day-push';`).
- Deploy edge functions: `npx supabase functions deploy <name> --project-ref gjffozmcbdtafdsxifyq` (dispatcher additionally `--no-verify-jwt`). `CRON_SECRET` and `ONESIGNAL_REST_API_KEY` are already project function secrets.
- Topics are exactly `prayer_times | events | stadium`, all opt-out (tag `= 'true'` OR tag `not_exists`).
- Title ≤ 65 chars, message ≤ 178 chars (OneSignal limits, enforced as DB checks).
- Staff predicate is the existing `public.is_staff()`. Default table privileges were revoked project-wide — every new table/function needs explicit `grant`s.
- After ANY `pnpm install`, rerun `python scripts/fix-windows-build-paths.py` (Windows path-length fix), per repo convention.
- Never send a test push to a real topic outside the planned live-fire events (the whole congregation receives them).
- Commit after every task; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Migration file — queue table, trigger, claim RPC, backfill, cron switch (write only, do not apply)

**Files:**
- Create: `supabase/migrations/20260713000002_notification_queue.sql`

**Interfaces:**
- Produces: table `public.notification_queue` (columns as below), `public.compose_event_reminder(public.events) → (title text, message text)`, `public.claim_due_notifications() → setof notification_queue`, trigger `event_notification_sync` on `public.events`. Task 2's dispatcher calls `claim_due_notifications()`; Tasks 6-11 read/write the table under RLS.

- [ ] **Step 1: Write the migration exactly as follows**

```sql
-- Unified notification queue: single source of truth for every push.
-- Spec: docs/superpowers/specs/2026-07-13-notification-queue-design.md

create table public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('event','stadium','template','composer','prayer_change')),
  source_id     uuid,
  title         text not null check (char_length(title) <= 65),
  message       text not null check (char_length(message) <= 178),
  topic         text not null check (topic in ('prayer_times','events','stadium')),
  route         text check (route is null or route like '/%'),
  url           text,
  fire_at       timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending','sent','failed','canceled','expired')),
  attempts      int not null default 0,
  sent_at       timestamptz,
  onesignal_id  text,
  recipients    int,
  error         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index nq_status_fire_at on public.notification_queue (status, fire_at);
-- one live reminder per event
create unique index nq_one_pending_per_event on public.notification_queue (source_id)
  where source = 'event' and status = 'pending';
-- duplicate-send guard: manual sources only (event reminders may share a minute)
create unique index nq_manual_minute_dedup on public.notification_queue
  (topic, date_trunc('minute', fire_at))
  where status = 'pending' and source in ('stadium','template','composer');

create or replace function public.nq_touch_updated_at()
returns trigger language plpgsql set search_path to '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger nq_touch before update on public.notification_queue
  for each row execute function public.nq_touch_updated_at();

alter table public.notification_queue enable row level security;
create policy nq_staff_read on public.notification_queue
  for select using (public.is_staff());
create policy nq_staff_insert on public.notification_queue
  for insert with check (public.is_staff());
-- staff may only cancel pending rows (never edit content or resurrect)
create policy nq_staff_cancel on public.notification_queue
  for update using (public.is_staff() and status = 'pending')
  with check (public.is_staff() and status = 'canceled');
-- stadium re-upload replaces that month's pending rows
create policy nq_staff_delete_pending on public.notification_queue
  for delete using (public.is_staff() and status = 'pending');

grant select, insert, update, delete on public.notification_queue to authenticated;
grant all on public.notification_queue to service_role;

-- audit (same pattern as other content tables)
create trigger audit_notification_queue
  after insert or delete or update on public.notification_queue
  for each row execute function public.write_audit();

-- Exact push text for an event reminder; single source shared by trigger,
-- backfill and (mirrored in TS) the admin preview.
create or replace function public.compose_event_reminder(ev public.events)
returns table (title text, message text)
language sql stable set search_path to '' as $$
  select
    left(ev.title, 59) || ' today',
    left(
      'Join us '
      || case
           when ev.time_label is not null
             then lower(left(ev.time_label, 1)) || substring(ev.time_label from 2)
           when ev.all_day then 'today'
           else 'at ' || trim(to_char(ev.starts_at at time zone 'Europe/London', 'FMHH12:MI am'))
         end
      || ' at Wembley Central Masjid. Tap for details.',
    178)
$$;

-- Keep each event's queue row in lockstep with the event.
create or replace function public.sync_event_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare c record;
begin
  if tg_op = 'DELETE' then
    update public.notification_queue set status = 'canceled'
      where source = 'event' and source_id = old.id and status = 'pending';
    return old;
  end if;
  if new.is_published and new.notify_at is not null then
    select * into c from public.compose_event_reminder(new);
    update public.notification_queue
       set fire_at = new.notify_at, title = c.title, message = c.message
     where source = 'event' and source_id = new.id and status = 'pending';
    if not found then
      insert into public.notification_queue
        (source, source_id, title, message, topic, route, fire_at, created_by)
      values
        ('event', new.id, c.title, c.message, 'events', '/event/' || new.id, new.notify_at, null);
    end if;
  else
    update public.notification_queue set status = 'canceled'
      where source = 'event' and source_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger event_notification_sync
  after insert or update or delete on public.events
  for each row execute function public.sync_event_notification();

-- Dispatcher claim: expire stale, then hand back everything due.
-- attempts increments per claim; the dispatcher marks failed after 3.
create or replace function public.claim_due_notifications()
returns setof public.notification_queue
language plpgsql security definer set search_path to '' as $$
begin
  update public.notification_queue set status = 'expired'
    where status = 'pending' and fire_at < now() - interval '6 hours';
  return query
    update public.notification_queue
       set attempts = attempts + 1
     where id in (
       select id from public.notification_queue
        where status = 'pending' and fire_at <= now()
        order by fire_at
        for update skip locked)
    returning *;
end $$;
revoke all on function public.claim_due_notifications() from public, anon, authenticated;
grant execute on function public.claim_due_notifications() to service_role;

-- Backfill: published events with a live future-ish reminder
insert into public.notification_queue (source, source_id, title, message, topic, route, fire_at, created_by)
select 'event', e.id, c.title, c.message, 'events', '/event/' || e.id, e.notify_at, null
from public.events e
cross join lateral public.compose_event_reminder(e) c
where e.is_published
  and e.notify_at is not null
  and e.notified_at is null
  and e.notify_at > now() - interval '6 hours';

-- queue status supersedes the old stamp; old dispatcher is unscheduled below,
-- so nothing reads this column any more
alter table public.events drop column if exists notified_at;

-- cron: hourly event-day-push -> 5-minute notification-dispatcher
select cron.unschedule('event-day-push');
select cron.schedule(
  'notification-dispatcher',
  '*/5 * * * *',
  $$select net.http_post(
      url := 'https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/notification-dispatcher',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','SET-AT-DEPLOY-TIME'),
      body := '{}'::jsonb)$$);
```

- [ ] **Step 2: Sanity-check the SQL parses (dry parse against live DB, rolled back)**

Run via the management API (Global Constraints) with the file's content wrapped as:
`begin; <file contents with cron lines removed>; rollback;`
(the two `cron.*` calls are session-external and excluded from the dry parse).
Expected: `[]` (no error).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260713000002_notification_queue.sql
git commit -m "notification_queue: table, RLS, event sync trigger, claim RPC, backfill, cron switch (not yet applied)"
```

---

### Task 2: `notification-dispatcher` edge function (deploy before the cron switches)

**Files:**
- Create: `supabase/functions/notification-dispatcher/index.ts`

**Interfaces:**
- Consumes: `public.claim_due_notifications()` (Task 1), env `CRON_SECRET`, `ONESIGNAL_REST_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: POST endpoint guarded by `x-cron-secret`; response `{ ok, claimed, sent, failed, expired_pruned }`.

- [ ] **Step 1: Write the function exactly as follows**

```ts
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
```

- [ ] **Step 2: Deploy (inert until the cron exists)**

Run: `npx supabase functions deploy notification-dispatcher --project-ref gjffozmcbdtafdsxifyq --no-verify-jwt`
Expected: deploy success. Then prove the guard: `curl -s -X POST https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/notification-dispatcher` → `{"error":"forbidden"}`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/notification-dispatcher/index.ts
git commit -m "notification-dispatcher: 5-minute queue dispatcher (claim, send, stamp, prune)"
```

---

### Task 3: Apply the migration live + trigger-matrix verification

**Files:** none (live DB state; migration from Task 1)

- [ ] **Step 1: Recover the real cron secret**

Management-API query: `select command from cron.job where jobname = 'event-day-push';`
Extract the `x-cron-secret` value from the returned command text.

- [ ] **Step 2: Apply the migration**

Send the full Task-1 file via the management API with `SET-AT-DEPLOY-TIME` replaced by the real secret.
Expected: `[]`. Then verify: `select jobname, schedule, active from cron.job;` → exactly one row `notification-dispatcher | */5 * * * * | true` (no `event-day-push`).

- [ ] **Step 3: Verify the backfill**

Query: `select source, status, title, fire_at at time zone 'Europe/London' as uk from public.notification_queue order by fire_at limit 10;`
Expected: one `event|pending` row per upcoming published event with a reminder (the weekly lectures at 17:00 UK, the test event at 20:53 UK) — texts non-empty, ≤65/≤178 chars.

- [ ] **Step 4: Trigger matrix (all via management API, in one transaction, rolled back at the end)**

```sql
begin;
insert into public.events (title, description, starts_at, all_day, category, location, is_published)
values ('TRIGGER TEST', 'x', now() + interval '2 days', false, 'community', '', true);
-- 1: pending row exists, fire_at = starts-2h (insert default trigger)
select count(*) = 1 as t1 from public.notification_queue q
  join public.events e on q.source_id = e.id
  where e.title = 'TRIGGER TEST' and q.status = 'pending'
    and q.fire_at = e.starts_at - interval '2 hours';
update public.events set title = 'TRIGGER TEST 2' where title = 'TRIGGER TEST';
-- 2: text recomposed
select count(*) = 1 as t2 from public.notification_queue
  where title = 'TRIGGER TEST 2 today' and status = 'pending';
update public.events set notify_at = now() + interval '1 day' where title = 'TRIGGER TEST 2';
-- 3: fire_at follows
select count(*) = 1 as t3 from public.notification_queue q
  join public.events e on q.source_id = e.id
  where e.title = 'TRIGGER TEST 2' and q.status = 'pending' and q.fire_at = e.notify_at;
update public.events set is_published = false where title = 'TRIGGER TEST 2';
-- 4: canceled on unpublish
select count(*) = 1 as t4 from public.notification_queue q
  join public.events e on q.source_id = e.id
  where e.title = 'TRIGGER TEST 2' and q.status = 'canceled';
update public.events set is_published = true where title = 'TRIGGER TEST 2';
-- 5: fresh pending row on republish (re-send capability)
select count(*) = 1 as t5 from public.notification_queue q
  join public.events e on q.source_id = e.id
  where e.title = 'TRIGGER TEST 2' and q.status = 'pending';
delete from public.events where title = 'TRIGGER TEST 2';
-- 6: canceled on delete
select count(*) = 0 as t6 from public.notification_queue q
  where q.source = 'event' and q.status = 'pending'
    and q.source_id not in (select id from public.events);
rollback;
```
Expected: every `tN` returns `true`. (Rolled back — no residue.)

- [ ] **Step 5: Outage drill + duplicate rules (transaction, rolled back)**

```sql
begin;
set local role service_role;
insert into public.notification_queue (source, title, message, topic, fire_at)
values ('template', 'STALE TEST', 'x', 'events', now() - interval '7 hours');
select count(*) as claimed from public.claim_due_notifications();  -- expires, claims nothing stale
select status = 'expired' as drill from public.notification_queue where title = 'STALE TEST';
reset role;
-- duplicate guard: second manual row same topic+minute must fail
insert into public.notification_queue (source, title, message, topic, fire_at)
values ('template', 'DUP A', 'x', 'events', date_trunc('minute', now() + interval '2 days'));
insert into public.notification_queue (source, title, message, topic, fire_at)
values ('composer', 'DUP B', 'x', 'events', date_trunc('minute', now() + interval '2 days'));
rollback;
```
Expected: `drill = true`; the second insert errors with `23505` (unique violation) — the transaction then rolls back. Note: `claimed` may also include genuinely-due rows if run near a real fire time; run between scheduled sends.

- [ ] **Step 6: Watch one live dispatcher run**

Wait for the next :00/:05 boundary, then: `select status, attempts, error from public.notification_queue where fire_at <= now();`
Expected: nothing stuck `pending` past its fire time; no `error` values. (If the 17:00 UK lecture reminder is next, watch it turn `sent` with an `onesignal_id` — that is the first live-fire proof.)

- [ ] **Step 7: Commit (no file changes — record verification)**

```bash
git commit --allow-empty -m "notification_queue migration applied live; trigger matrix, outage drill, dedup verified"
```

---

### Task 4: Slim `send-push` + one-time OneSignal import

**Files:**
- Modify: `supabase/functions/send-push/index.ts`

**Interfaces:**
- Consumes: `notification_queue` (service-role insert).
- Produces (for admin callers): body `{ title, message, topic, url?, route?, source? }` → immediate send + `sent` log row. Temporary `{ action: 'migrate_scheduled' }` → `{ ok, imported, canceled, details }`. `{ action: 'cancel', id }` kept only until Step 4 completes (deleted in Task 12). **Removed:** `send_after`, `action: 'list_scheduled'` — admin sections stop using them in Tasks 9-11.

- [ ] **Step 1: Edit the function**

Keep: CORS, staff-auth block, topic whitelist, length checks, published-event deep-link check, immediate-send block, `fetchPending` helper, `cancel` action.
Delete: the whole `send_after` branch (parse/30-day/duplicate-guard/`sendAfter` in payload), the `list_scheduled` action.
Add after the immediate-send succeeds (`resp.ok`):

```ts
    // every send leaves a log row — the admin's 30-day audit trail
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const src = body.source === 'prayer_change' ? 'prayer_change' : 'composer';
    await service.from('notification_queue').insert({
      source: src,
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
```

Add the temporary import action (before the send block):

```ts
  // ONE-TIME migration: move OneSignal-held schedules into the queue.
  if (body.action === 'migrate_scheduled') {
    const pending = await fetchPending();
    if (pending === null) return json({ ok: false, errors: 'could not reach OneSignal' }, 502);
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    let imported = 0, canceled = 0;
    const details: unknown[] = [];
    for (const n of pending) {
      const { error } = await service.from('notification_queue').insert({
        source: n.route === '/stadium' ? 'stadium' : 'template',
        title: n.title, message: n.message,
        topic: n.topic ?? 'events',
        route: n.route, url: n.url,
        fire_at: new Date((n.send_after as number) * 1000).toISOString(),
        created_by: user!.id,
      });
      if (!error) imported++;
      const del = await fetch(
        `https://api.onesignal.com/notifications/${n.id}?app_id=${ONESIGNAL_APP_ID}`,
        { method: 'DELETE', headers: { Authorization: `Key ${key}` } },
      );
      if (del.ok) canceled++;
      details.push({ title: n.title, imported: !error, canceled: del.ok, error: error?.message ?? null });
    }
    return json({ ok: true, found: pending.length, imported, canceled, details });
  }
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy send-push --project-ref gjffozmcbdtafdsxifyq`
Expected: success.

- [ ] **Step 3: Snapshot OneSignal pending count**

Mint a staff JWT (established flow: service_role → `generate_link` → verify → access token), then call the function with `{ action: 'migrate_scheduled' }` **not yet** — first record what exists: temporarily still possible via OneSignal dashboard, or simply proceed: the action itself returns `found`.

- [ ] **Step 4: Run the import once and verify**

`curl -s -X POST https://gjffozmcbdtafdsxifyq.supabase.co/functions/v1/send-push -H "Authorization: Bearer $STAFF_JWT" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"action":"migrate_scheduled"}'`
Expected: `found == imported == canceled` (July stadium mornings). Then queue check: `select source, count(*) from public.notification_queue where status = 'pending' group by source;` — stadium rows present. Re-running returns `found: 0` (idempotent because OneSignal is now empty).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-push/index.ts
git commit -m "send-push: immediate-only + sent-log rows; one-time OneSignal schedule import (temporary action)"
```

---

### Task 5: Admin UK-time library with tests

**Files:**
- Create: `apps/admin/src/lib/uktime.ts`
- Test: `apps/admin/src/lib/uktime.test.ts`
- Modify: `apps/admin/package.json` (add `"test": "vitest run"` script; devDependency `"vitest": "^3.2.4"` — match the version in `packages/shared/package.json`)

**Interfaces:**
- Produces (all later admin tasks import these):
  - `ukToIso(date: string, time: string): string` — UK wall clock → UTC ISO (absorbs the three existing copies)
  - `isoToUkInput(iso: string | null): string` — UTC ISO → `"YYYY-MM-DDTHH:mm"` UK wall clock (for `datetime-local` inputs); `''` for null/invalid
  - `formatUk(isoOrUnixSeconds: string | number): string` — `"Sun 13 Jul, 8:53 pm"` UK display

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatUk, isoToUkInput, ukToIso } from './uktime';

describe('uktime (viewer-timezone independent: all via Intl Europe/London)', () => {
  it('converts UK summer wall clock to UTC (BST, +1)', () => {
    expect(ukToIso('2026-07-13', '20:53')).toBe('2026-07-13T19:53:00.000Z');
  });
  it('converts UK winter wall clock to UTC (GMT, +0)', () => {
    expect(ukToIso('2026-01-13', '09:00')).toBe('2026-01-13T09:00:00.000Z');
  });
  it('round-trips ISO to a UK datetime-local value (summer)', () => {
    expect(isoToUkInput('2026-07-13T19:53:00.000Z')).toBe('2026-07-13T20:53');
  });
  it('round-trips ISO to a UK datetime-local value (winter)', () => {
    expect(isoToUkInput('2026-01-13T09:00:00.000Z')).toBe('2026-01-13T09:00');
  });
  it('returns empty for null/invalid', () => {
    expect(isoToUkInput(null)).toBe('');
    expect(isoToUkInput('nonsense')).toBe('');
  });
  it('formats display time in UK regardless of machine timezone', () => {
    expect(formatUk('2026-07-13T19:53:00.000Z')).toBe('Mon 13 Jul, 8:53 pm');
    expect(formatUk(1784322780)).toBe(formatUk(new Date(1784322780 * 1000).toISOString()));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter admin exec vitest run` (after `pnpm install` + `python scripts/fix-windows-build-paths.py`)
Expected: FAIL — module `./uktime` not found.

- [ ] **Step 3: Implement**

```ts
/** All admin date maths is Europe/London, whatever the viewer's machine says. */

function ukParts(d: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** UK wall time -> UTC ISO (handles BST/GMT). */
export function ukToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23',
  });
  const offset = (Number(fmt.format(new Date(guess))) - h! + 24) % 24;
  return new Date(guess - offset * 3600 * 1000).toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" UK wall clock, for datetime-local inputs. */
export function isoToUkInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = ukParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Mon 13 Jul, 8:53 pm" in UK time. */
export function formatUk(isoOrUnixSeconds: string | number): string {
  const d = typeof isoOrUnixSeconds === 'number'
    ? new Date(isoOrUnixSeconds * 1000)
    : new Date(isoOrUnixSeconds);
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  }).replace(' at ', ', ');
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter admin exec vitest run`
Expected: 6 passed. Also run once with the machine timezone forced away from UK to prove independence: `TZ=Asia/Kolkata pnpm --filter admin exec vitest run` (PowerShell: `$env:TZ='Asia/Kolkata'; pnpm --filter admin exec vitest run`) — same 6 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/uktime.ts apps/admin/src/lib/uktime.test.ts apps/admin/package.json pnpm-lock.yaml
git commit -m "admin: single UK-time library (tested, viewer-timezone independent)"
```

---

### Task 6: Queue client library

**Files:**
- Create: `apps/admin/src/lib/queue.ts`
- Test: `apps/admin/src/lib/queue.test.ts`

**Interfaces:**
- Consumes: `supabase` client (`../lib/supabase`), `notification_queue` under staff RLS.
- Produces (Tasks 7-11 import these — exact signatures):
  - `interface QueueRow { id: string; source: 'event'|'stadium'|'template'|'composer'|'prayer_change'; source_id: string | null; title: string; message: string; topic: 'prayer_times'|'events'|'stadium'; route: string | null; url: string | null; fire_at: string; status: 'pending'|'sent'|'failed'|'canceled'|'expired'; sent_at: string | null; recipients: number | null; error: string | null; }`
  - `listUpcoming(): Promise<QueueRow[]>` — pending, ascending `fire_at`
  - `listSent(): Promise<QueueRow[]>` — non-pending, last 30 days, descending
  - `insertQueued(rows: NewQueueRow[]): Promise<{ ok: number; duplicates: number; failures: string[] }>` where `interface NewQueueRow { source: 'stadium'|'template'|'composer'; title: string; message: string; topic: string; route?: string; url?: string; fire_at: string; }`
  - `cancelRow(id: string): Promise<string | null>` — null on success, error message otherwise
  - `composeEventReminder(ev: { title: string; starts_at: string; all_day: boolean; time_label: string | null }): { title: string; message: string }` — TS mirror of the SQL, for the form's live preview
  - `SOURCE_LABELS: Record<QueueRow['source'], string>` and `TOPIC_LABELS: Record<string, string>` (moved from `lib/push.ts`)

- [ ] **Step 1: Write the failing test (pure logic only — DB calls are exercised live in later tasks)**

```ts
import { describe, expect, it } from 'vitest';
import { composeEventReminder } from './queue';

describe('composeEventReminder mirrors compose_event_reminder (SQL)', () => {
  it('timed event: clock time in UK', () => {
    expect(composeEventReminder({
      title: 'test event', starts_at: '2026-07-13T21:53:00Z', all_day: false, time_label: null,
    })).toEqual({
      title: 'test event today',
      message: 'Join us at 10:53 pm at Wembley Central Masjid. Tap for details.',
    });
  });
  it('labelled event: lower-cased label wins over all_day', () => {
    expect(composeEventReminder({
      title: 'Urdu Seerah', starts_at: '2026-07-13T11:00:00Z', all_day: true, time_label: 'After Maghrib Salah',
    }).message).toBe('Join us after Maghrib Salah at Wembley Central Masjid. Tap for details.');
  });
  it('all-day without label: "today"; long titles clamp to 65', () => {
    expect(composeEventReminder({
      title: 'x'.repeat(80), starts_at: '2026-07-13T11:00:00Z', all_day: true, time_label: null,
    }).title.length).toBeLessThanOrEqual(65);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter admin exec vitest run queue`
Expected: FAIL — module `./queue` not found.

- [ ] **Step 3: Implement**

```ts
import { supabase } from './supabase';

export interface QueueRow {
  id: string;
  source: 'event' | 'stadium' | 'template' | 'composer' | 'prayer_change';
  source_id: string | null;
  title: string;
  message: string;
  topic: 'prayer_times' | 'events' | 'stadium';
  route: string | null;
  url: string | null;
  fire_at: string;
  status: 'pending' | 'sent' | 'failed' | 'canceled' | 'expired';
  sent_at: string | null;
  recipients: number | null;
  error: string | null;
}
export interface NewQueueRow {
  source: 'stadium' | 'template' | 'composer';
  title: string;
  message: string;
  topic: string;
  route?: string;
  url?: string;
  fire_at: string;
}

export const TOPIC_LABELS: Record<string, string> = {
  prayer_times: 'Prayer Times',
  events: 'Events',
  stadium: 'Stadium',
};
export const SOURCE_LABELS: Record<QueueRow['source'], string> = {
  event: 'Event reminder',
  stadium: 'Stadium day',
  template: 'Scheduled (template)',
  composer: 'Composer',
  prayer_change: 'Prayer time change',
};

const COLS = 'id,source,source_id,title,message,topic,route,url,fire_at,status,sent_at,recipients,error';

export async function listUpcoming(): Promise<QueueRow[]> {
  const { data } = await supabase
    .from('notification_queue').select(COLS)
    .eq('status', 'pending').order('fire_at');
  return (data as QueueRow[]) ?? [];
}

export async function listSent(): Promise<QueueRow[]> {
  const { data } = await supabase
    .from('notification_queue').select(COLS)
    .neq('status', 'pending')
    .gte('fire_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('fire_at', { ascending: false });
  return (data as QueueRow[]) ?? [];
}

/** Insert scheduled rows one by one so a duplicate (23505) skips, not aborts. */
export async function insertQueued(
  rows: NewQueueRow[],
): Promise<{ ok: number; duplicates: number; failures: string[] }> {
  let ok = 0;
  let duplicates = 0;
  const failures: string[] = [];
  for (const r of rows) {
    const { error } = await supabase.from('notification_queue').insert(r);
    if (!error) ok++;
    else if (error.code === '23505') duplicates++;
    else failures.push(`${r.title}: ${error.message}`);
  }
  return { ok, duplicates, failures };
}

export async function cancelRow(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('notification_queue').update({ status: 'canceled' }).eq('id', id);
  return error ? error.message : null;
}

/** TS mirror of public.compose_event_reminder — used for the form preview. */
export function composeEventReminder(ev: {
  title: string; starts_at: string; all_day: boolean; time_label: string | null;
}): { title: string; message: string } {
  const label = ev.time_label?.trim() ? ev.time_label.trim() : null;
  const when = label
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : ev.all_day
      ? 'today'
      : `at ${new Date(ev.starts_at).toLocaleTimeString('en-GB', {
          timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit',
        })}`;
  return {
    title: `${ev.title.slice(0, 59)} today`,
    message: `Join us ${when} at Wembley Central Masjid. Tap for details.`.slice(0, 178),
  };
}
```

- [ ] **Step 4: Run tests, verify pass; typecheck**

Run: `pnpm --filter admin exec vitest run queue` → 3 passed. `pnpm --filter admin typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/queue.ts apps/admin/src/lib/queue.test.ts
git commit -m "admin: notification_queue client library + event-reminder preview mirror"
```

---

### Task 7: Events form & list — UK datetimes, Time-type radio, Reminder picker, status

**Files:**
- Modify: `apps/admin/src/sections/CrudSection.tsx`

**Interfaces:**
- Consumes: `ukToIso`, `isoToUkInput`, `formatUk` (Task 5); `composeEventReminder`, `QueueRow`, `supabase` queue reads (Task 6).
- Produces: events editor writes `all_day`, `time_label`, `notify_at` consistently; every `datetime` column in every CRUD section is UK-wall-clock in and out.

- [ ] **Step 1: UK-ify the generic datetime handling**

In `toInput` replace the datetime branch (currently local `getHours` maths) with `return isoToUkInput(String(value));` and in `fromInput` replace `if (type === 'datetime') return new Date(value).toISOString();` with `if (type === 'datetime') { const [d, t] = value.split('T'); return ukToIso(d!, t!); }`. In the list renderer, replace the `toLocaleString` datetime cell with `formatUk(String(row[c.key]))`. Append `" (UK)"` to the three datetime labels in the notices/news/events configs. Update the events note to `'Only published events appear in the app. All times are UK (Europe/London), whatever timezone this computer is in.'`

- [ ] **Step 2: Add the events schedule controls**

In the events config, mark `all_day`, `time_label`, `notify_at` with a new flag `formHidden: true` (add to `Column`; Editor skips rendering them as plain fields; payload still built from `values`, so they submit as managed by the component below). In `Editor`, when `config.table === 'events'`, render `<EventScheduleFields values={values} setValues={setValues} row={row} />` in their place (import at top; component in the same file, below Editor):

```tsx
function EventScheduleFields({ values, setValues, row }: {
  values: Record<string, string | boolean>;
  setValues: (updater: (prev: Record<string, string | boolean>) => Record<string, string | boolean>) => void;
  row: Row | null;
}) {
  const timeType = values.all_day
    ? (String(values.time_label).trim() ? 'flexible' : 'allday')
    : 'fixed';
  const [reminderMode, setReminderMode] = useState<'auto' | 'morning' | 'custom' | 'none'>(
    () => (row ? (values.notify_at ? 'custom' : 'none') : 'auto'),
  );
  const [queueRow, setQueueRow] = useState<QueueRow | null>(null);

  useEffect(() => {
    if (!row) return;
    supabase.from('notification_queue')
      .select('id,source,source_id,title,message,topic,route,url,fire_at,status,sent_at,recipients,error')
      .eq('source', 'event').eq('source_id', row.id)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setQueueRow((data?.[0] as QueueRow) ?? null));
  }, [row]);

  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));

  // starts_at in values is the UK "YYYY-MM-DDTHH:mm" input string
  const startsIso = typeof values.starts_at === 'string' && values.starts_at
    ? ukToIso(values.starts_at.split('T')[0]!, values.starts_at.split('T')[1] ?? '00:00')
    : null;

  const applyReminder = (mode: typeof reminderMode) => {
    setReminderMode(mode);
    if (!startsIso) return;
    const day = values.starts_at ? String(values.starts_at).split('T')[0]! : '';
    if (mode === 'auto') {
      set('notify_at', timeType === 'fixed'
        ? isoToUkInput(new Date(Date.parse(startsIso) - 2 * 3600 * 1000).toISOString())
        : `${day}T09:00`);
    } else if (mode === 'morning') set('notify_at', `${day}T09:00`);
    else if (mode === 'none') set('notify_at', '');
    // 'custom': leave the field for the input below
  };

  const preview = startsIso
    ? composeEventReminder({
        title: String(values.title ?? ''),
        starts_at: startsIso,
        all_day: timeType !== 'fixed',
        time_label: timeType === 'flexible' ? String(values.time_label) : null,
      })
    : null;

  return (
    <>
      <label>Time type</label>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
        {([['fixed', 'Fixed time'], ['flexible', 'Flexible (label instead of a time)'], ['allday', 'All day']] as const)
          .map(([v, lbl]) => (
            <label key={v} style={{ fontWeight: 400, display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" checked={timeType === v} style={{ width: 'auto', margin: 0 }}
                onChange={() => {
                  set('all_day', v !== 'fixed');
                  if (v !== 'flexible') set('time_label', '');
                }} />
              {lbl}
            </label>
          ))}
      </div>
      {timeType === 'flexible' && (
        <>
          <label>Time label (shown instead of a clock time, e.g. "After Maghrib Salah")</label>
          <input value={String(values.time_label ?? '')} onChange={(e) => set('time_label', e.target.value)} />
        </>
      )}

      <label>Reminder notification</label>
      <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        {([['auto', timeType === 'fixed' ? 'Automatic (2h before)' : 'Automatic (9am UK)'],
           ['morning', 'Morning of event (9am UK)'], ['custom', 'Custom (UK)'], ['none', 'No reminder']] as const)
          .map(([v, lbl]) => (
            <label key={v} style={{ fontWeight: 400, display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" checked={reminderMode === v} style={{ width: 'auto', margin: 0 }}
                onChange={() => applyReminder(v)} />
              {lbl}
            </label>
          ))}
      </div>
      {reminderMode === 'custom' && (
        <input type="datetime-local" value={String(values.notify_at ?? '')}
          onChange={(e) => set('notify_at', e.target.value)} />
      )}

      {queueRow?.status === 'sent' && (
        <p className="ok">Sent ✓ {formatUk(queueRow.sent_at!)}{queueRow.recipients != null ? ` — ${queueRow.recipients} devices` : ''}</p>
      )}
      {(queueRow?.status === 'failed' || queueRow?.status === 'expired') && (
        <p className="err">Reminder {queueRow.status}{queueRow.error ? ` — ${queueRow.error}` : ''}</p>
      )}
      {reminderMode !== 'none' && values.notify_at && preview && (
        <p className="note">
          Fires {formatUk(ukToIso(String(values.notify_at).split('T')[0]!, String(values.notify_at).split('T')[1] ?? '00:00'))} (UK) —
          "{preview.title}: {preview.message}"
        </p>
      )}
      {reminderMode === 'none' && <p className="note">No push notification will be sent for this event.</p>}
    </>
  );
}
```

(`values.notify_at` and `values.starts_at` are already UK-input strings thanks to Step 1; `fromInput` converts them back. `reminderMode` initialisation for existing rows shows `custom` with the stored UK time visible — truthful, since every stored value is explicit.)

- [ ] **Step 3: Reminder column in the events list**

In `CrudSection` (list component), when `config.table === 'events'`, after loading rows also fetch their queue rows (`in('source_id', ids)`, `eq('source','event')`), keep a `Map<source_id, QueueRow>` in state (prefer `pending`, else latest), and append a `Reminder` header + cell: pending → `formatUk(fire_at)`; sent → `✓ {formatUk(sent_at)}`; failed/expired → red status word; none → `—`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter admin typecheck && pnpm --filter admin build` → clean.
Manual (vite dev, machine on IST): open Events → Urdu Seerah shows Starts `12:00` (not 16:30); Time type = Flexible with the label; reminder preview line shows 17:00 UK fire time and the exact text; the list shows the Reminder column. Create a throwaway **unpublished** event: pick each reminder preset and watch the preview line update; delete it after.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/sections/CrudSection.tsx
git commit -m "admin events: UK datetimes everywhere, time-type radio, reminder picker with live preview and sent status"
```

---

### Task 8: Notifications section (timeline) + navigation

**Files:**
- Create: `apps/admin/src/sections/Notifications.tsx`
- Modify: `apps/admin/src/App.tsx` (add nav entry + render; follow the existing section-switch pattern in that file)

**Interfaces:**
- Consumes: `listUpcoming`, `listSent`, `cancelRow`, `QueueRow`, `SOURCE_LABELS`, `TOPIC_LABELS` (Task 6); `formatUk` (Task 5).
- Produces: `export function Notifications({ goTo }: { goTo: (section: string) => void })` — `goTo` is App's existing section-setter, used for jump-to-source links.

- [ ] **Step 1: Write the section**

```tsx
import { useCallback, useEffect, useState } from 'react';

import { formatUk } from '../lib/uktime';
import {
  cancelRow, listSent, listUpcoming, SOURCE_LABELS, TOPIC_LABELS, type QueueRow,
} from '../lib/queue';

const SOURCE_SECTION: Partial<Record<QueueRow['source'], string>> = {
  event: 'events',
  stadium: 'stadium',
  template: 'schedule',
  composer: 'push',
};

function tapOpens(r: QueueRow): string {
  if (r.route?.startsWith('/event/')) return 'event page';
  if (r.route) return `app screen ${r.route}`;
  if (r.url) return `web: ${r.url.slice(0, 40)}`;
  return 'the app';
}

export function Notifications({ goTo }: { goTo: (section: string) => void }) {
  const [tab, setTab] = useState<'upcoming' | 'sent'>('upcoming');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setRows(tab === 'upcoming' ? await listUpcoming() : await listSent());
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (r: QueueRow) => {
    if (!window.confirm(`Cancel "${r.title}" (${formatUk(r.fire_at)} UK)? It will not be sent.`)) return;
    const e = await cancelRow(r.id);
    if (e) setErr(`Could not cancel: ${e}`);
    else load();
  };

  return (
    <>
      <h2>Notifications</h2>
      <p className="note">
        Every push the app will send and (for 30 days) has sent — event reminders, stadium days,
        scheduled, composer and prayer-time changes. Cancel here; edit at the source.
      </p>
      {err && <p className="err">{err}</p>}
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        <button className={tab === 'upcoming' ? 'btn' : 'btn secondary'} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button className={tab === 'sent' ? 'btn' : 'btn secondary'} onClick={() => setTab('sent')}>Sent (30 days)</button>
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="note">{tab === 'upcoming' ? 'Nothing waiting to send.' : 'Nothing sent in the last 30 days.'}</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>When (UK)</th><th>Audience</th><th>Title</th><th>Message</th><th>Tap opens</th><th>Source</th>
                <th>{tab === 'upcoming' ? '' : 'Outcome'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatUk(r.fire_at)}</td>
                  <td>{TOPIC_LABELS[r.topic] ?? r.topic}</td>
                  <td>{r.title.slice(0, 40)}</td>
                  <td>{r.message.slice(0, 60)}</td>
                  <td>{tapOpens(r)}</td>
                  <td>
                    {SOURCE_LABELS[r.source]}
                    {SOURCE_SECTION[r.source] && (
                      <>
                        {' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); goTo(SOURCE_SECTION[r.source]!); }}>edit</a>
                      </>
                    )}
                  </td>
                  <td>
                    {tab === 'upcoming' ? (
                      <button className="btn secondary" onClick={() => cancel(r)}>Cancel</button>
                    ) : (
                      r.status === 'sent'
                        ? <span className="ok">sent ✓{r.recipients != null ? ` ${r.recipients}` : ''}</span>
                        : <span className={r.status === 'canceled' ? 'note' : 'err'}>{r.status}{r.error ? ` — ${r.error.slice(0, 60)}` : ''}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

Match the file's existing nav pattern: add a `notifications` entry labelled **Notifications** directly after the events entry, render `<Notifications goTo={setSection} />` (whatever the section-state setter is named there), and pass the same setter. Use the exact section keys already present for events/stadium/schedule/composer in `SOURCE_SECTION` — check `App.tsx` and correct the four strings if its keys differ.

- [ ] **Step 3: Verify**

`pnpm --filter admin typecheck && pnpm --filter admin build` → clean. Manual: Upcoming lists lectures + test event + imported stadium rows, all UK times; Sent shows tonight's/today's sends; cancel a **stadium** row and watch it move to Sent tab as `canceled` — then re-create it via Stadium re-upload in Task 9's verification.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/sections/Notifications.tssx apps/admin/src/App.tsx
git commit -m "admin: Notifications timeline (upcoming + 30-day sent log, cancel, jump-to-source)"
```

---

### Task 9: Stadium Days → queue

**Files:**
- Modify: `apps/admin/src/sections/StadiumDays.tsx`

**Interfaces:**
- Consumes: `insertQueued` (Task 6), `ukToIso` (Task 5), `supabase`.
- Produces: stadium scheduling writes `source: 'stadium'` rows; month re-upload replaces pending stadium rows.

- [ ] **Step 1: Replace the scheduling block**

Remove `callSendPush` from imports (keep `supabase`); delete the local `ukToIso` (import from `../lib/uktime`). In `save()`, replace the whole `if (notify) { for (const d of days) { … callSendPush … } }` block with:

```ts
      let scheduled = 0;
      let skipped = 0;
      let failures: string[] = [];
      if (notify) {
        // replace this month's pending stadium notifications along with the days
        for (const w of windows) {
          await supabase.from('notification_queue').delete()
            .eq('source', 'stadium').eq('status', 'pending')
            .gte('fire_at', ukToIso(w.from, '00:00'))
            .lt('fire_at', ukToIso(w.to, '00:00'));
        }
        const rows = days
          .map((d) => ({ d, iso: ukToIso(d.date, notifyTime) }))
          .filter(({ iso }) => Date.parse(iso) > Date.now() + 60_000)
          .map(({ iso }) => ({
            source: 'stadium' as const,
            title: 'Stadium Event Day at Wembley',
            message: 'Expect parking restrictions and heavy traffic around the Masjid today. Please plan ahead or use public transport.',
            topic: 'stadium',
            route: '/stadium',
            fire_at: iso,
          }));
        const res = await insertQueued(rows);
        scheduled = res.ok;
        skipped = res.duplicates;
        failures = res.failures;
      }
```

Update the status line's failure text to use `failures.join('; ')`, and change the on-page note that warned about re-uploads to: `Re-uploading a month replaces its scheduled notifications too — nothing is double-sent.`

- [ ] **Step 2: Verify**

`pnpm --filter admin typecheck && pnpm --filter admin build` → clean. Manual: re-upload the July flyer (the same one as before) → status reports the days saved and notifications scheduled; Notifications → Upcoming shows one stadium row per remaining July day at 08:00 UK, no duplicates (the canceled row from Task 8's check is re-created).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/sections/StadiumDays.tsx
git commit -m "stadium days: schedule via notification_queue; month re-upload replaces pending pushes"
```

---

### Task 10: Scheduled Notifications (template) → queue

**Files:**
- Modify: `apps/admin/src/sections/SchedulePush.tsx`

**Interfaces:**
- Consumes: `listUpcoming`, `insertQueued`, `cancelRow`, `QueueRow`, `TOPIC_LABELS` (Task 6); `ukToIso`, `formatUk` (Task 5).
- Produces: template rows insert `source: 'template'` queue rows; the list reads the queue.

- [ ] **Step 1: Switch the section**

- Delete the local `ukToIso` + `formatUk`; import from `../lib/uktime`. Replace `ScheduledItem` + `destinationLabel` + `TOPIC_LABELS` imports from `../lib/push` with `QueueRow`, `TOPIC_LABELS` from `../lib/queue` and a local `tapOpens` copy of Task 8's helper (three lines).
- In `validateRow`, delete the 30-day branch (`if (Date.parse(ukToIso(r.date, r.time)) > Date.now() + 30 * 24 * 3600 * 1000) …`) — long-range scheduling is now supported.
- `refreshScheduled` becomes `setScheduled(await listUpcoming())` (state type `QueueRow[]`).
- `scheduleAll` loops become one call: build `NewQueueRow[]` from valid rows (`source: 'template'`, `fire_at: ukToIso(r.date, r.time)`, `route`/`url` as before) and call `insertQueued`; report `ok/duplicates/failures` in the status line with the same wording as today.
- `cancel` uses `cancelRow(item.id)`.
- The "Waiting to send" table: `send_after` → `fire_at` (`formatUk(s.fire_at)`), destination → `tapOpens(s)`; add a Source column with `SOURCE_LABELS[s.source]`.
- Template instruction row 5→ replace the 30-day sentence in the notes sheet with: `'Notifications can be scheduled any distance ahead. Event reminders are automatic — every published event sends at its reminder time.'`

- [ ] **Step 2: Verify**

`pnpm --filter admin typecheck && pnpm --filter admin build` → clean. Manual: download template, add one row 45 days out (previously rejected) → validates, schedules, appears in Upcoming; a duplicate row (same topic+minute) reports "skipped"; cancel it from this section's list.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/sections/SchedulePush.tsx
git commit -m "template scheduling: queue-backed, 30-day cap removed, duplicate rows skipped by DB guard"
```

---

### Task 11: Composer scheduled sends + prayer-change source tag

**Files:**
- Modify: `apps/admin/src/sections/PushComposer.tsx`
- Modify: `apps/admin/src/sections/Timetable.tsx:119-123`

**Interfaces:**
- Consumes: `insertQueued`, `listUpcoming`, `cancelRow` (Task 6); `ukToIso`, `formatUk` (Task 5); `callSendPush` (immediate only).
- Produces: composer schedule → `source: 'composer'` rows; prayer-change pushes tagged `source: 'prayer_change'`.

- [ ] **Step 1: PushComposer**

- Imports as in Task 10 (uktime + queue instead of push.ts helpers; keep `callSendPush`).
- In `send()`: if `sendAt` is set, do **not** call `callSendPush`; instead `insertQueued([{ source: 'composer', title, message, topic: effectiveTopic, fire_at: ukWallTimeToIso(sendAt), …route/url as currently built }])`, then report duplicates ("same audience already scheduled at that minute — pick another time or cancel it in Notifications") or success. If `sendAt` is empty, keep the existing `callSendPush` (no `send_after` key — it no longer exists).
- Replace the local `ukWallTimeToIso`/`formatUk` with the Task-5 imports (`ukToIso(date, time)` — split the `datetime-local` value on `'T'`).
- Scheduled list + cancel: same swap as Task 10.

- [ ] **Step 2: Timetable — one line**

In the `callSendPush({ title: 'Prayer time change', … })` call add `source: 'prayer_change',`.

- [ ] **Step 3: Verify**

`pnpm --filter admin typecheck && pnpm --filter admin build` → clean. Manual: compose a **scheduled** push to `stadium` topic for 23:50 UK tonight titled "QUEUE TEST — ignore" → appears in Upcoming → cancel it there (never sends). Immediate path: leave untouched (verified live in Task 12 by the next real prayer-change).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/sections/PushComposer.tsx apps/admin/src/sections/Timetable.tsx
git commit -m "composer: scheduled sends via queue; prayer-change pushes tagged in the log"
```

---

### Task 12: Cleanup, dead-code deletion, full regression pass

**Files:**
- Delete: `supabase/functions/event-day-push/index.ts` (whole folder), `apps/admin/src/lib/push.ts`
- Modify: `supabase/functions/send-push/index.ts` (delete `migrate_scheduled`, `cancel`, `fetchPending`)

- [ ] **Step 1: Delete the dead code**

Remove the three items above. Grep gate — all must return nothing:
`grep -rn "send_after\|list_scheduled\|migrate_scheduled\|notified_at\|event-day-push\|lib/push'" apps/admin/src supabase/functions`
(the only permitted `send_after` hits: none; fix any stragglers).

- [ ] **Step 2: Redeploy send-push; typecheck/build/test everything**

`npx supabase functions deploy send-push --project-ref gjffozmcbdtafdsxifyq`
`pnpm --filter admin exec vitest run && pnpm --filter admin typecheck && pnpm --filter admin build` → all clean.

- [ ] **Step 3: Full regression drill (live)**

1. **Live fire**: create a real published event "Reminder system check" starting +3h, reminder Custom = now +10 min, category `community` — watch: queue row pending → next :05 run → `sent` with `onesignal_id` → push arrives on the phone → tap opens the event page. Then delete the event (row cancels — wait, it is already `sent`; the delete leaves the sent log row untouched — confirm exactly that).
2. **Trigger matrix**: re-run Task 3 Step 4 transaction → all `tN = true`.
3. **Outage + duplicate**: re-run Task 3 Step 5 → same results.
4. **Timezone**: with the machine on IST, walk Events / Notifications / Stadium / Scheduled — every displayed time is UK; the Urdu Seerah placeholder reads 12:00.
5. **Regression bar**: tomorrow's (or today's) 17:00 lecture reminder and the nightly stadium morning row must show `sent ✓` in the Sent tab after their times pass.

- [ ] **Step 4: Update the admin deploy + memory of record**

`git push` (GitHub Pages redeploys the admin). Verify the deployed bundle contains the new section: `curl -s https://omarmo2403-collab.github.io/wcm-app/admin/assets/<current-bundle>.js | grep -c "Sent (30 days)"` → `1`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "notification queue: delete legacy scheduling paths (event-day-push, OneSignal send_after, push.ts)"
git push
```

---

## Self-review notes (resolved inline)

- **Task 8 Step 5 filename typo** — `Notifications.tssx` → the commit command must use `Notifications.tsx`. Corrected here so the engineer copies the right path: `git add apps/admin/src/sections/Notifications.tsx apps/admin/src/App.tsx`.
- Spec coverage walked: data model (T1), trigger semantics incl. re-send-after-sent (T1/T3), dispatcher + expiry + retries + prune (T2/T3), OneSignal import (T4), send-log for instant sends (T4/T11), UK time everywhere (T5/T7), reminder picker writing explicit `notify_at` (T7), Notifications timeline w/ cancel + jump links (T8), stadium replace (T9), 30-day cap removal (T10), composer/prayer logging (T11), dead-code deletion + regression bar (T12). No gaps found.
- Type consistency: `QueueRow`/`NewQueueRow`/`insertQueued`/`cancelRow`/`listUpcoming`/`listSent`/`composeEventReminder` names match across Tasks 6-11; `ukToIso`/`isoToUkInput`/`formatUk` match across 5, 7, 8, 9, 10, 11.
