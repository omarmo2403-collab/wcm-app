# Unified Notification Queue — Design

**Date:** 13 July 2026 · **Status:** approved by Omar (pending spec review) · **Approach:** single DB queue (option 3 of 3)

## Problem

The app sends pushes through five separate paths with two competing sources of truth:

| Path | Schedule lives in | Visible in admin? |
|---|---|---|
| Event reminders | DB (`events.notify_at`), hourly dispatcher | Form field only; no fire-time preview, no sent status |
| Stadium day mornings | OneSignal `send_after` (set at import) | Only via OneSignal-paging list |
| Template bulk schedules | OneSignal `send_after` | Same list |
| Composer (instant or scheduled) | OneSignal / none | Scheduled only; instant leaves no record |
| Prayer-time change alerts | none (instant) | No record |

Confirmed defects: admin datetimes render in the **viewer's** timezone (an IST browser shows a noon-UK event as 16:30) while claiming "Times are UK local"; three duplicated UK-time helpers (and none where it mattered most); OneSignal's ~30-day scheduling cap shapes the UX and blocks long-range planning; re-uploading a stadium month replaces the days but strands the already-scheduled pushes; the duplicate-send guard cannot see event reminders; no audit trail of what was actually sent; the only flood-protection after an outage covers events alone.

## Solution overview

One Postgres table, **`notification_queue`**, is the single source of truth for every push — pending and (for 30 days) sent. OneSignal holds **no schedules**: one dispatcher sends every due row immediately at fire time. OneSignal returns to being a pure delivery pipe.

```
event trigger ─┐
stadium import ─┤                       ┌─> OneSignal (immediate send only)
template upload ─┼─> notification_queue ─┤
composer ───────┤   (pending rows)      └─> status: sent | failed | expired
prayer change ──┘   + sent log rows
                         ▲
        admin Notifications section (read + cancel)
```

Consequences: the 30-day cap disappears; "Upcoming" is one indexed query (today: up to 20 OneSignal API pages filtered client-side); every send leaves a log row; one flood-protection rule covers everything.

## Data model

```sql
create table public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('event','stadium','template','composer','prayer_change')),
  source_id     uuid,                          -- events.id / stadium_days.id where applicable
  title         text not null check (char_length(title) <= 65),
  message       text not null check (char_length(message) <= 178),
  topic         text not null check (topic in ('prayer_times','events','stadium')),
  route         text check (route is null or route like '/%'),   -- in-app deep link
  url           text,                                            -- web link (route wins if both)
  fire_at       timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending','sent','failed','canceled','expired')),
  attempts      int not null default 0,
  sent_at       timestamptz,
  onesignal_id  text,
  recipients    int,
  error         text,
  created_by    uuid,                          -- auth.users.id of the staff member (null = system)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

Indexes / constraints:
- `(status, fire_at)` — dispatcher scan and Upcoming tab.
- Partial unique `(source, source_id) where source = 'event' and status = 'pending'` — one live reminder per event.
- Partial unique `(topic, date_trunc('minute', fire_at)) where status = 'pending' and source in ('stadium','template','composer')` — the duplicate-send guard, DB-enforced. **Event rows are exempt**: several event reminders may legitimately share a minute (e.g. two 9am reminders); the dispatcher sends them all in one run, as today.

RLS: staff (`app_role` admin/editor) may `select` all rows, `insert` (constraints validate shape), and `update` only `pending → canceled`. The dispatcher uses the service role. No anon access.

`events.notified_at` is dropped (queue status supersedes it). `events.notify_at` **stays** — it is the editing surface on the event; the queue row mirrors it.

## Event sync trigger

`sync_event_notification()` — after insert/update/delete on `events`:

| Event change | Queue effect |
|---|---|
| Inserted/updated, published, future `notify_at` | Upsert the pending row: `fire_at = notify_at`, title/message recomputed |
| Title / start / time-type edited | Pending row's text + `fire_at` recomputed |
| `notify_at` set to null, or unpublished, or deleted | Pending row → `canceled` |
| Reminder re-set after a send (`notify_at` moved to future, no pending row) | Fresh pending row (partial unique index permits it — an improvement; today re-sending is impossible) |

Message composition ports the dispatcher's current TS logic to one SQL function (`compose_event_reminder`): heading "«title» today"; body "Join us <time_label, lower-cased first letter | 'today' | at HH:MM UK> at Wembley Central Masjid. Tap for details."; `route = /event/<id>`; `topic = 'events'`. Blank labels are already normalised to null at the DB (migration `20260713000001`).

## Dispatcher

`notification-dispatcher` edge function (renamed from `event-day-push`), pg_cron **every 5 minutes** (was hourly; ~8.6k invocations/month, well inside free tier). Each run, under the service role:

1. `select … where status = 'pending' and fire_at <= now() order by fire_at for update skip locked` — safe even if two runs overlap.
2. Rows with `fire_at < now() - interval '6 hours'` → `expired` (never late-sent). One flood rule for **all** sources.
3. Otherwise POST to OneSignal (immediate; same topic filters as today: tag `= 'true'` OR tag `not_exists`). Success → `sent` + `sent_at`, `onesignal_id`, `recipients`. Failure → `attempts + 1`; stays `pending` while `attempts < 3` (retried next runs), then `failed` + `error`.
4. Prune: delete rows where `status <> 'pending'` and `coalesce(sent_at, fire_at) < now() - interval '30 days'` — the rolling one-month audit trail.

Auth: unchanged `x-cron-secret` header.

## send-push edge function (slimmed)

Keeps: staff auth, topic whitelist, title/message length checks, published-event deep-link validation, **immediate** OneSignal sends. After a successful immediate send it inserts a `sent` log row (service-role client) — composer "now" and prayer-change pushes become visible history.

Loses: `send_after` scheduling, the 30-day checks, `list_scheduled` and its pagination, the OneSignal-side duplicate guard (now a DB constraint). The `cancel` action survives only until the one-time migration (below) completes, then is deleted.

Scheduled sends from the admin become **direct `insert` into `notification_queue`** under RLS — the DB constraints are the shared validation.

## Admin surfaces

All datetime handling consolidates into `apps/admin/src/lib/uktime.ts` (`ukToIso`, `isoToUkParts`, `formatUk`); the three existing copies are deleted, and CrudSection's datetime fields — the one place with **no** UK handling — convert on both display and save. Every datetime label says "(UK)".

- **Events form** — "Time type" radio: `Fixed time` / `Flexible` (label, e.g. "After Maghrib Salah") / `All day`; sets `all_day` + `time_label` consistently. "Reminder" picker: `Automatic` / `Morning of event (9am UK)` / `Custom (UK)` / `No reminder`, with a live line: fire time + the exact push text; after sending, "Sent ✓ <when>, <n> devices"; `failed`/`expired` shown red with reason. The form always writes an **explicit** `notify_at` (`Automatic` computes 2h-before / 9am itself, mirroring the DB rule; `No reminder` writes null) — the insert-time DB default remains only as a safety net for rows created outside the form.
- **Events list** — Reminder column: fire time + status glyph.
- **Notifications section (new)** — *Upcoming*: pending rows (When UK · Audience · Title · Tap-opens · Source→jump link · Cancel). *Sent*: last 30 days, all outcomes, recipients count. Cancel = `status := 'canceled'` with confirm; **editing happens at the source** (jump links), never here.
- **Stadium Days** — scheduling inserts queue rows (`source = 'stadium'`); re-upload of a month **deletes that month's pending stadium rows first** — the stranded-push trap is gone.
- **Scheduled Notifications (template)** — rows insert directly to the queue; the 30-day validation error and the OneSignal list are removed; "Waiting to send" reads the queue.
- **Composer / Timetable** — UX unchanged; their sends now appear in *Sent*.
- **Mobile app** — zero changes (delivery, topics, deep links untouched).

## Migration & rollout order

1. **DB migration**: table, indexes, RLS, trigger, `compose_event_reminder`; backfill pending rows for **published** events with a future `notify_at`; drop `notified_at`.
2. **Dispatcher** deployed on the 5-minute cron (old hourly job unscheduled in the same migration). From here everything already flows — no gap.
3. **One-time OneSignal import** (guarded admin action): list pending OneSignal sends → insert queue rows (source inferred: `/stadium` route → stadium, else template) → cancel each in OneSignal → show both counts; operator confirms they match.
4. **Admin UI** switch (all sections above) + slimmed send-push.
5. **Delete** dead code: pagination, 30-day checks, `notified_at` references, old cron name.

Each step leaves the system fully working; reminders cannot be missed mid-migration.

## Verification (pre-launch bar)

- **Live fire**: real event, reminder ~15 min out — queue row → dispatcher log → phone push → deep link opens the event page.
- **Trigger matrix** (SQL): create / retitle / re-time / set-reminder-null / unpublish / delete → assert queue row state after each.
- **Outage drill**: pending row 7h stale → run → `expired`, nothing sent.
- **Duplicate rules**: same-minute template rows rejected; same-minute event reminders both send.
- **Timezone**: IST browser shows UK wall times everywhere (Urdu Seerah placeholder = 12:00, not 16:30).
- **Regression bar**: the 5pm lecture reminders and the current test event fire identically through the queue.

## Out of scope

Local on-device prayer notifications (scheduled by the app itself; not server pushes). Editing schedules from the Notifications timeline (cancel + jump-to-source only). Notification history beyond 30 days.
