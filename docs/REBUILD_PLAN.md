# Wembley Central Masjid — React Native Rebuild Plan

**Prepared:** 10 July 2026
**Source material:** `prototype/` (HTML/CSS/JS demo), `WCM_Mobile_App_Proposal_v2.docx`
**Confirmed decisions:** donations link out to the existing web donation page (v1) · custom web admin dashboard · no end-user accounts in v1 · **published under Afom Solutions Pvt Ltd's existing Apple/Google developer accounts** (the masjid does not want the account-setup process) · work is done on a **volunteer basis — running costs must be as close to £0 as possible** · **Ask-the-Scholar feature removed from scope entirely** (not needed) — the app therefore has no public write endpoint and collects no user-entered PII.

---

## 1. Reverse-Engineering Findings

### 1.1 What the existing artefact is

The repo contains a **static, single-page prototype** (`prototype/index.html`, `app.js`, `style.css`) rendered inside a fake iPhone frame and deployed to GitHub Pages via `.github/workflows/pages.yml`. It is a **sales/UX demo**, not an application: it exists to show the masjid committee what the app will look like, styled to match wembleycentralmasjid.co.uk.

### 1.2 How it works internally

- **Navigation:** a hand-rolled screen switcher. Every screen is a `<div class="screen">`; `showScreen()` (tab-level) and `showSubScreen()` (pushed detail screens with a back button) toggle an `active` class and rewrite the header. A one-deep `screenHistory` array simulates a navigation stack.
- **Data:** everything is hardcoded. Prayer times are static HTML; events and news are JS arrays; donate category copy is a JS object; stadium event days are static HTML.
- **The only real logic:** Gregorian date rendering, Hijri date via `Intl.DateTimeFormat('en-u-ca-islamic')` with a hardcoded fallback, a status-bar clock, and an auto-scrolling banner carousel with dots.
- **Everything transactional is stubbed:** donate → `alert('Payment screen would open here')`; Ask the Scholar → toast + form reset (data discarded); notification toggles → cosmetic checkboxes; Qibla → static needle at 119°; virtual tour / directions / call / email → `alert()`; live events URL → empty config constant that shows a "coming soon" toast; the prayer-times countdown ("Asr Iqamah in 8:49") is **hardcoded and never ticks**.

**Conclusion:** there is no business logic to port. The prototype's value is (a) the settled information architecture, (b) the visual design system, and (c) the committee's implicit sign-off on both. The rebuild is a greenfield build against those.

### 1.3 Design system extracted from `style.css`

| Token | Value | Usage |
|---|---|---|
| `--green` | `#159778` | Brand primary (matches website) |
| `--green-dark` / `--green-darker` | `#0C7058` / `#326E59` | Pressed states, gradients |
| `--purple` | `#914BA1` | Donations accent |
| `--cream` / `--cream-half` | `#FCF7EE` / `rgba(236,216,180,.5)` | Prayer widget background |
| `--grey-bg` | `#EFF0F5` | Screen background |
| Radii | 12 / 8 px | Cards / inputs |
| Type | ProximaNova → system stack | Headings 700, body 400 |

Assets to carry over: `logo-icon.svg`, `logo-text.svg`, `salaah-assets/*` (prayer widget iconography), 7 gallery JPEGs (these become seed content in Supabase Storage, not bundled assets).

### 1.4 Business context (from the proposal)

- Quoted **£1,599** total development (incl. £79 Apple + £20 Google accounts), **≤£409/yr** maintenance, **8–9 weeks** to launch.
- Reference product: the East London Mosque app.
- Sales pitch hinges on: prayer/iqamah notifications, push announcements (90% open rate claim), simplified giving (1,000 Sponsors @ 30p/day campaign), Ask the Scholar, Madrasah hub, 360° tour.
- The proposal assumed the masjid would open its own Apple/Google developer accounts. **Superseded:** the masjid declined the account-setup process, so the app ships under Afom Solutions' existing accounts (see header decisions and §10 store-compliance implications).

---

## 2. Complete Feature Inventory

Legend: ✅ ship in v1 · 🔶 v1 but simplified vs proposal · 🕐 phase 2 · ✳️ new (not in prototype, required for production).

| # | Feature | Prototype state | Rebuild scope |
|---|---|---|---|
| 1 | Prayer timetable widget (begins + iqamah, 6 prayers + sunrise + Jumu'ah ×2) | Static HTML | ✅ Live from Supabase, offline-cached |
| 2 | Next-prayer countdown | Fake, frozen | ✅ Real, ticking, recomputed on foreground |
| 3 | Hijri + Gregorian date | Partially real | ✅ With **admin-set moon-sighting offset** |
| 4 | Monthly prayer timetable ("Prayer Times for July 2026" button) | Dead button | ✳️ ✅ Full month grid screen + share/print |
| 5 | Prayer notifications: 5 daily reminders **15 min before iqamah** + Jumu'ah extra on Fridays (per-prayer toggles, adjustable lead time) | Cosmetic toggles | ✅ Locally scheduled from cached timetable (see notification matrix, §4) |
| 6 | Push notifications, 7 topic categories | Cosmetic toggles | ✅ OneSignal tags/segments, sent from admin panel |
| 7 | Events list | Mock array | ✅ Supabase-backed, categorised |
| 8 | Event detail | None (cards inert) | ✳️ ✅ Detail screen + add-to-calendar + share |
| 9 | Live events link-out | Empty config const | ✅ Remote-config URL (changeable without release) |
| 10 | Stadium event days (parking notices + date list) | Static HTML | ✅ Event category `stadium` + home notice strip driven by data |
| 11 | Donate hub (Zakaat, Sadaqah, Sponsor, General) | Copy + amount picker + alert | 🔶 Category screens with copy from CMS → **link out** to the masjid's web donation page (per decision); native Stripe deferred to phase 2 |
| 12 | Madrasah (intro, class schedule, enrolment CTA) | Static table | ✅ CMS-driven schedule + contact CTA |
| 13 | Digital Madrasah Hub (homework, parent notices, progress) | Not built (proposal only) | 🕐 Requires parent accounts, safeguarding review |
| 14 | Ask the Scholar form | Toast stub, data discarded | ❌ **Cut from scope (10 Jul 2026 decision).** Its home quick-action slot and More-menu entry are replaced — suggest the monthly Prayer Times screen for the quick action (aligns with the app's core purpose); its promo banner is simply not seeded |
| 15 | News feed | Mock array | ✅ Supabase-backed |
| 16 | Qibla compass | Static needle | ✅ Live magnetometer + GPS great-circle bearing to the Kaaba |
| 17 | Banner carousel (campaigns) | 3 hardcoded slides | ✅ CMS-driven with deep-link actions and schedule windows |
| 18 | Notice strip (home) | Hardcoded parking notice | ✅ CMS-driven, dismissible |
| 19 | Gallery | 6 bundled images | ✅ Supabase Storage-backed; "See All" grid screen (dead in prototype) |
| 20 | About / charity info | Static | ✅ CMS-driven copy |
| 21 | Contact (call, email, address, map) | `alert()` stubs | ✅ Real `tel:`/`mailto:` links + native map with directions intent |
| 22 | Services (Nikaah, funeral, open days…) | Static grid | ✅ CMS-driven |
| 23 | 360° virtual tour | `alert()` stub | 🔶 In-app WebView/browser to an existing tour URL (remote config); native 360° viewer is not worth building |
| 24 | Admin content management | N/A | ✳️ ✅ **Comprehensive CMS** — every content type in the app is editable: timetable (grid editor + CSV import + quick-edit), events, news, banners, notices, gallery, donations copy/URLs, madrasah, services, push composer with delivery stats, config, staff roles + audit log (full spec in §7) |
| 25 | Analytics / crash reporting | N/A | ✳️ ✅ PostHog + Sentry |

---

## 3. Challenged Design Decisions (senior-architect review)

1. **"Push notification system" as a single feature is the wrong framing.** Prayer alerts and announcements have opposite delivery requirements. Prayer alerts must fire at exact minute-level times, per-user, per-prayer, every day — doing that with server push means ~35 scheduled sends/user/week and a hard dependency on delivery latency. **Do it with locally scheduled notifications instead**: the app caches the timetable 60 days ahead and schedules OS-level local notifications on-device. Works offline, exact, free, no server. **Platform constraint that shapes the design:** iOS allows at most **64 pending local notifications per app**, so the app maintains a *rolling window* (~10 days of prayer alerts) that is topped up on every app open, background fetch, and silent push — never a one-shot "schedule two months" approach. On Android 12+, minute-accurate delivery requires the `SCHEDULE_EXACT_ALARM` permission (prayer apps are a legitimate use); without it Doze mode can delay alerts by several minutes, which for iqamah is a miss. Remote push (OneSignal) is reserved for what it's good at: announcements, events, appeals — human-triggered, latency-tolerant, segmentable.

2. **The prototype's donate amount-picker is misleading scope.** It implies in-app payment, which the committee has now (sensibly) deferred. Keep the category screens (they do the persuasion work) but make the CTA an honest "Continue to secure donation page". Do **not** ship a fake payment UI — Apple reviewers reject dead-end payment flows.

3. **Hijri via `Intl` alone is wrong for a mosque.** The Umm al-Qura calendar frequently disagrees with UK moon-sighting announcements by ±1 day, and Ramadan/Eid dates are decided by the masjid, not by ICU. Compute Hijri locally (`@umalqura/core`, pure JS — avoids Hermes `Intl` calendar gaps) **plus an admin-controlled day offset** in remote config.

4. **Countdown must be derived, not stored.** The prototype freezes "8:49 minutes". The app computes next-prayer state from the timetable + `Date.now()` in a memoised selector, re-evaluated on an interval and on `AppState` foreground — never trusting a stale render.

5. **Stadium event days are events, not a separate feature.** Model them as `events.category = 'stadium'`; the home notice strip and the stadium info screen both query the same table. One admin workflow instead of two.

6. **The five-tab bar wastes a slot.** "Madrasah" as a top-level tab is committee politics, not usage frequency. Keep it (the committee approved this IA and the tab cost is low), but flag it: if analytics show low engagement, swap the slot for "Prayer Times" (monthly view) in a later release. This is a data-informed decision the analytics stack enables.

7. **GitHub Pages + hand-rolled navigation tells us nothing to keep.** No router, no state library, no build system exists to migrate. That's an advantage: no legacy constraints.

8. **Gallery images must not ship in the binary.** 7 bundled JPEGs already bloat the prototype; in production, media comes from Supabase Storage with on-device caching (`expo-image`), so the committee can refresh photos without an app release.

---

## 4. Improvements Over the Existing Web App

- **Offline-first:** timetable, events, news cached (TanStack Query + MMKV persister). A mosque app is used at the mosque — often with bad reception.
- **Real countdown + "next prayer" state machine**, including the Maghrib edge case (begins = iqamah) and post-Isha rollover to tomorrow's Fajr.
- **Monthly timetable screen** (the prototype's dead button) with month picker — replaces the printed timetable use-case, shareable as image/PDF.
- **Add-to-calendar and share** on events (`expo-calendar`, native share sheet).
- **Deep links / push → screen routing:** a push about an event opens that event (Expo Router deep linking; OneSignal payload carries the route).
- **Live Qibla** with sensor-accuracy warning and calibration hint, falling back to the static bearing (119° from Wembley) when sensors are unavailable.
- **Remote config** (`app_config` table) for live-events URL, donation URLs, tour URL, contact details, hijri offset — the prototype hardcodes all of these; none should require an app release to change.
- **Dismissible, scheduled notice strip** instead of a permanent parking banner.
- **Accessibility:** dynamic type support, VoiceOver/TalkBack labels, WCAG-AA contrast (the cream-on-white prayer widget needs contrast checks), 44pt touch targets — none of which the prototype attempts.
- **OTA updates (EAS Update):** copy tweaks and JS fixes ship without store review.
- **Ramadan readiness:** timetable schema includes optional Suhoor-end/Iftar columns and a `is_ramadan` config flag that promotes them in the widget — built now, activated next Ramadan.

### Mobile-first UX recommendations

- **Home = glanceable answer to "when is the next prayer".** Widget on top, countdown prominent; everything else scrolls below. Skeleton loaders, never spinners-over-blank.
- **Tab bar:** Home · Events · Donate · Madrasah · More (as approved). Sub-screens are real stack pushes with native back-swipe — the prototype's one-deep history becomes a proper navigator.
- **Notification onboarding** *(amended 13 Jul 2026 — Omar's TestFlight review)*: fire the OS permission dialog immediately on first launch — this audience installs the app for the alerts, so the prompt needs no warm-up. (Originally: value-proposition card first, prompt on affirmative tap.) Denied-permission state keeps the settings deep-link on the notification-settings screen.
- **Notification matrix (confirmed requirement).**

  | Alert | When it fires | Frequency | Channel |
  |---|---|---|---|
  | Prayer reminder ×5 (Fajr, Zuhr, Asr, Maghrib, Isha) | **15 min before iqamah** (default; user-adjustable 5/10/15/20/30 min; per-prayer on/off) | 5/day | Local scheduled |
  | Jumu'ah reminder | 15 min before first Jumu'ah (setting to choose 1st/2nd sitting or both) | +1–2 Fridays | Local scheduled |
  | Iqamah-change announcement | Immediately when admin edits times ≤14 days out | As needed | Remote push (auto) |
  | Event / stadium-day / announcement / appeal | Composed or scheduled in admin panel; events get an optional "notify on publish" and a day-before reminder | As needed | Remote push (topics) |

  **Budget maths vs the iOS 64-pending cap:** 5/day + Jumu'ah ≈ 36/week → a 12-day rolling window is the ceiling (≈62 pending); the plan's 10-day window (~52) leaves headroom. If a per-prayer *begins-time* alert is ever added as a second alarm type, the window must shrink to ~6 days — the scheduling module treats window length as derived from enabled alert count, not a constant.

- **Iqamah-change reliability chain (THE core requirement).** The masjid changes iqamah times frequently and congregants miss prayers — this is the app's reason to exist, so notification correctness gets a four-layer design:
  1. **Local notifications** in a rolling ~10-day window (iOS caps pending notifications at 64), topped up on every app open, background fetch and silent push, from a 60-day cached timetable. Exact-time, works offline. Android uses exact alarms (`SCHEDULE_EXACT_ALARM`).
  2. **On any admin edit** touching the next 14 days, the admin panel automatically sends (a) a **visible topic push** — "Isha iqamah is now 10:45pm from tomorrow" — and (b) a **silent data push** (`content-available`) that wakes the app to re-fetch and reschedule local notifications without user action.
  3. **Daily background sync** via `expo-background-task` (WorkManager on Android, BGTaskScheduler on iOS — note: `expo-background-fetch` is deprecated as of SDK 53; do **not** use it) re-syncs the timetable opportunistically, catching devices the silent push missed (iOS delivers silent pushes best-effort only).
  4. **Foreground re-sync** on every app open as the final guarantee.
  A congregant who never opens the app still gets layer 2a (the visible change announcement) — the one channel that cannot go stale.
  **Fleet telemetry:** every successful reschedule emits an anonymous PostHog event (`notifications_rescheduled`, with timetable version); every failure goes to Sentry as an alertable error. After an iqamah change, the dashboard can answer "what % of devices have re-synced?" instead of waiting for complaints at the masjid door.
- **Admin quick-edit for iqamah:** because changes are frequent, the dashboard needs a one-tap "edit today/tomorrow/this-week's iqamah" flow (single prayer, single field) — not just the monthly CSV import. Saving triggers the change-push automation above.
- **Notification self-verification ("trust but verify" UX):** the notification settings screen shows the *actual* next scheduled alerts read back from the OS ("Next: Fajr Iqamah alert, tomorrow 4:15am ✓"), a **"send test notification"** button, live permission status with a fix-it deep link, and — on Android — a battery-optimisation exemption prompt for aggressive OEMs (Xiaomi/Huawei/Samsung Doze killers). Users and staff can see with their own eyes that alerts are armed and correct, instead of discovering a failure at Fajr.
- **Honest reliability model:** the *times* can be made 100% correct (they come from one authoritative table), but *delivery* can never be 100% on hardware we don't control — users can revoke permission, force-quit, or own a phone that kills background apps. The design goal is: no user ever receives a **wrong** time (the fatal failure), and non-delivery is always locally diagnosable (the self-verification screen) and covered by the visible change-push layer.
- **Haptics on prayer-widget interactions and toggles; reduced-motion respect for the banner carousel** (auto-scroll pauses on interaction and honours `prefers-reduced-motion`).
- **Dark mode:** ship v1 light-only (matches brand, halves the design/QA cost inside the budget) but build with semantic colour tokens so dark mode is a token-file change later.

---

## 5. Technology Stack & Justification

| Layer | Choice | Why (and why not the alternative) |
|---|---|---|
| App framework | **Expo SDK (latest) + React Native + TypeScript (strict)** | Managed workflow removes native-project maintenance a £0 running budget can't fund. TS strict from day one — cheapest time to adopt. |
| Routing | **Expo Router** (file-based, typed routes) | Maps 1:1 to the tab+stack IA; deep linking and push-routing come nearly free. React Navigation alone would mean hand-wiring linking config. |
| Server state | **TanStack Query** + persister on **MMKV** | ~90% of app state is server data with caching/refetch/offline needs — exactly TanStack's job. MMKV is ~30× faster than AsyncStorage and synchronous. |
| Client state | **Zustand** (small) | Only for: notification prefs mirror, onboarding-complete flag, dismissed-notice ids. Redux would be ceremony for three booleans. |
| Backend | **Supabase (Free tier)** — Postgres, RLS, Storage, Edge Functions | One service covers DB + media + serverless + admin auth. Free tier (500MB DB, 1GB storage, 500k Edge invocations) is generous for a single-mosque app. Firebase was the alternative; Postgres + SQL + RLS beats Firestore for relational content (timetables, events) and avoids vendor-proprietary data. |
| Push (remote) | **OneSignal (Free)** | Segments/tags map to the 7 notification topics; delivery analytics; a dashboard the masjid can use directly if the admin panel is down. Free ≤10k subscribers. Expo Push was the alternative (also free) but has no staff-facing dashboard or delivery reporting. |
| Push (prayer alerts) | **expo-notifications, locally scheduled** | See §3.1. Zero cost, exact timing, offline. |
| Forms & validation | **React Hook Form + Zod** | Admin-panel forms (the mobile app now has no user-input forms at all). Zod schemas shared between app, Edge Functions, and admin panel — one source of validation truth. |
| Crash reporting | **Sentry (Free)** via `@sentry/react-native` | Source-mapped native + JS crashes; free tier (5k errors/mo) is plenty. |
| Analytics | **PostHog (Free, EU cloud)** | 1M events/mo free, EU data residency (GDPR-friendly for a UK charity), no Firebase SDK weight. Firebase Analytics rejected: adds Google services config + consent complexity for no benefit at this scale. |
| Qibla/sensors | `expo-location` + `expo-sensors` | Managed-workflow native APIs; bearing math is ~20 lines. |
| Hijri | `@umalqura/core` + config offset | Pure JS, no Hermes `Intl` dependency (§3.3). |
| Images | `expo-image` | Built-in disk caching, blurhash placeholders for gallery/banners. |
| Admin dashboard | **Vite + React + TypeScript**, Supabase Auth (email link). **Hosted on GitHub Pages under /wcm-app/admin/** — deployed as-built 11 Jul 2026; Cloudflare Pages remains the optional later move for a custom admin domain + Turnstile login check | Internal tool: no SSR/SEO need, so a SPA beats Next.js for simplicity. GitHub Pages chosen at build time because the repo's deploy pipeline already existed and needed no new credentials; functionally equivalent for a static SPA (security lives in Supabase RLS, not the host). |
| CI/CD | **EAS Build + EAS Submit + EAS Update** (free tier) + GitHub Actions (lint/typecheck/test) | Free tier ≈30 builds/mo — ample for this cadence. OTA updates via EAS Update (1k MAU free… upgrade only when exceeded). |
| Testing | Jest + React Native Testing Library; Maestro for 3–4 smoke flows | Budget-proportionate: unit-test prayer-time logic hard (it's the product), smoke-test navigation. |
| Tooling | pnpm workspaces monorepo, ESLint + Prettier, Supabase CLI migrations, generated DB types | `supabase gen types typescript` keeps app/admin/DB in lockstep. |

**Explicitly deferred:** Stripe (phase 2, per decision), Supabase Auth for end-users (phase 2 Madrasah hub), i18n framework (structure copy as string resources now, add `i18next` when Urdu/Arabic/Gujarati is requested), home-screen widgets (high native complexity; revisit post-launch).

---

## 6. System Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Mobile app (Expo RN, TS)   │        │  Admin dashboard (Vite SPA)  │
│                             │        │  Cloudflare Pages            │
│  Expo Router (tabs+stacks)  │        │  Supabase Auth (staff only)  │
│  TanStack Query ⇄ MMKV      │        └──────────────┬───────────────┘
│  Zustand (ui prefs)         │                       │ authed writes (RLS: admin)
│  expo-notifications (local  │        ┌──────────────▼───────────────┐
│   alerts, rolling 10d win.) │  anon  │         SUPABASE             │
│  OneSignal SDK (topics)     │  read  │  Postgres + RLS              │
└──────────────┬──────────────┘  only  │  Storage (gallery/banners)   │
               ├────────────────────►  │  Edge Function:              │
               │                       │   • send-push (admin-only,   │
   ┌───────────▼───────────┐           │      calls OneSignal API)    │
   │ OneSignal             │◄──────────│                              │
   │ segments = topics     │  send API │                              │
   │ delivery analytics    │           │                              │
   └───────────────────────┘           └──────────────────────────────┘

External link-outs: donation page (web), live events URL, 360° tour, maps.
Observability: Sentry (app+admin) · PostHog (app events, admin usage).
```

**Data flow rules:**
- The app **only reads** Supabase (anon key, RLS `select` on published rows). There are no public write endpoints at all — the anon key needs zero insert/update/delete policies.
- All writes originate from the admin dashboard under an authenticated staff JWT with an `admin` role claim, or from Edge Functions using the service role.
- Push sends go admin panel → `send-push` Edge Function → OneSignal REST API, so the OneSignal API key never reaches a browser.
- On app start / foreground / background fetch / silent push: refetch today+60d timetable → diff against the scheduled rolling notification window → reschedule if changed, top up to ~10 days.

---

## 7. Database & Backend Design (Supabase)

```sql
-- Authoritative masjid timetable (admin-uploaded monthly, CSV import in dashboard)
prayer_times (
  date date primary key,
  fajr_begins time, fajr_iqamah time,
  sunrise time,
  zuhr_begins time, zuhr_iqamah time,
  asr_begins time, asr_iqamah time,
  maghrib_begins time, maghrib_iqamah time,
  isha_begins time, isha_iqamah time,
  suhoor_ends time null, iftar time null,        -- Ramadan
  notes text null
)

jumuah_times ( id, khutbah_time time, iqamah_time time, label text, sort_order int, active bool )

events (
  id uuid pk, title text, description text,
  starts_at timestamptz, ends_at timestamptz null, all_day bool default false,
  category text check (category in ('community','lecture','madrasah','stadium','ramadan','eid','fundraising')),
  location text null, image_path text null,
  is_published bool default false, created_at, updated_at
)

news ( id uuid pk, title, body text, image_path null, published_at timestamptz null, is_published bool )

banners (
  id uuid pk, badge text, title text, subtitle text,
  action_type text check (action_type in ('screen','url','none')),
  action_target text,                            -- e.g. '/donate' or https URL
  image_path null, sort_order int,
  starts_at timestamptz null, ends_at timestamptz null, is_active bool
)

notices ( id uuid pk, icon text, message text, action_type, action_target,
          starts_at, ends_at, is_active bool )   -- home notice strip

donation_categories ( id, slug text unique, title, description, icon, url text, sort_order, is_active )

madrasah_classes ( id, name, days text, time_range text, sort_order, is_active )

services ( id, title, description, icon, sort_order, is_active )

gallery_images ( id, storage_path, caption null, sort_order, is_published )

app_config ( key text pk, value jsonb )
  -- live_events_url, tour_url, hijri_offset_days, contact info, qibla_bearing,
  -- is_ramadan, charity_number, donation fallback URL

admin_users: Supabase Auth users + role claim via custom access token hook
             ('admin' = everything incl. push + user management;
              'editor' = content CRUD only, no push, no config, no users).
             RLS write policies check the claim. No self-signup — invited only.

audit_log ( id uuid pk, actor_id uuid, actor_email text, action text,
            entity text, entity_id text, diff jsonb, created_at timestamptz )
  -- written by a trigger on every admin-role mutation; read-only in the UI.
  -- Answers "who changed Friday's iqamah and when" — essential once
  -- multiple staff can edit the timetable.
```

### Admin dashboard — full module specification

Every piece of content in the app is manageable here; nothing requires Supabase Studio or a developer. Modules:

1. **Overview (home).** Timetable coverage gauge (days remaining, red under 30), last iqamah change + device re-sync percentage (from PostHog), recent audit-log entries, quick links.
2. **Prayer times.** Month-grid editor (spreadsheet-style inline editing), CSV/XLSX bulk import with dry-run validation report, **quick-edit flow** (today/tomorrow/this week, single prayer), Jumu'ah times manager, Ramadan columns (suhoor/iftar) with an "activate Ramadan mode" toggle, validation rules (iqamah ≥ begins, chronological order, no gaps, same-day-change confirmation), and an explicit banner showing which changes will trigger the automatic change-push before saving.
3. **Events.** Full CRUD, category picker (incl. stadium event days), image upload, draft → published workflow, recurrence helper for weekly programmes, list + calendar views, **"send push on publish" checkbox and optional scheduled reminder push (e.g. day before at 6pm)** — both routed through the send-push Edge Function with the event deep link attached.
4. **News.** Full CRUD with rich-text body (headings, links, lists), image upload, draft/publish, scheduled publish-at.
5. **Banners & notices.** CRUD with schedule windows (starts/ends), drag-to-reorder, action targets (app screen picker or URL), live phone-frame preview.
6. **Gallery.** Multi-upload with client-side resize/compress before hitting Storage, captions, drag-to-reorder, publish toggles.
7. **Donations.** Edit category copy, icons, ordering, and target URLs (so campaign pages can change without a release).
8. **Madrasah & Services.** CRUD for class schedule rows and service cards; intro/enrolment copy editing.
9. **Push composer.** Topic picker (segments), title/body with character counters and phone-frame preview, optional deep-link target (screen picker), send-now or schedule, full send history with OneSignal delivery stats, and a confirm step showing audience size.
10. **App config.** Form-based editor (not raw JSON) for live-events URL, tour URL, Hijri offset (with "what today becomes" preview), contact details, Ramadan flag.
11. **Users & audit.** Invite/revoke staff, assign admin/editor roles, searchable audit log.

**Cross-cutting:** every content type gets draft/publish, the phone-frame live preview component (renders the same React components as the app where feasible via shared packages), optimistic UI with rollback, and mobile-responsive layout (committee members will use it from phones). Design system: shadcn/ui themed to WCM green so it feels first-party.

**RLS posture:** default-deny; public `select` policies filtered on `is_published`/`is_active` and date windows; all writes require the admin claim. Storage buckets: `media` public-read, admin-write.

**Edge Function (just one):**
1. `send-push` — requires admin JWT; composes OneSignal API call (topic segment, title, body, deep-link route); logs the send.

---

## 8. Repository & Folder Structure

pnpm monorepo (single repo keeps shared Zod schemas and generated DB types honest):

```
wcm/
├─ apps/
│  ├─ mobile/                     # Expo app
│  │  ├─ app/                     # Expo Router
│  │  │  ├─ (tabs)/
│  │  │  │  ├─ index.tsx          # Home
│  │  │  │  ├─ events/  (index, [id])
│  │  │  │  ├─ donate/  (index, [category])
│  │  │  │  ├─ madrasah.tsx
│  │  │  │  └─ more/    (index, about, news/, qibla,
│  │  │  │              contact, services, tour, notifications, stadium)
│  │  │  ├─ prayer-times/[month].tsx
│  │  │  ├─ onboarding.tsx
│  │  │  └─ _layout.tsx
│  │  └─ src/
│  │     ├─ features/             # prayer-times/ (logic + hooks + widget UI),
│  │     │                        # events/ news/ donate/ qibla/
│  │     │                        # notifications/ gallery/ banners/
│  │     ├─ components/ui/        # Card, Button, Skeleton, Toast…
│  │     ├─ lib/                  # supabase.ts, onesignal.ts, analytics.ts,
│  │     │                        # sentry.ts, storage.ts (MMKV), hijri.ts
│  │     ├─ theme/                # tokens.ts (colors/spacing/type from prototype)
│  │     └─ stores/               # zustand: preferences.ts, ui.ts
│  └─ admin/                      # Vite SPA: timetable CSV import, CRUD screens,
│     └─ src/{features,components,lib}   # push composer, gallery upload
├─ packages/
│  └─ shared/                     # Zod schemas, generated supabase types,
│                                 # prayer-time domain logic (pure TS, heavily tested)
├─ supabase/
│  ├─ migrations/  ├─ functions/  └─ seed.sql
└─ .github/workflows/             # ci.yml (typecheck+lint+test), eas.yml
```

The **prayer-time domain logic lives in `packages/shared`** as pure functions (`getNextPrayer(timetable, now)`, `buildNotificationSchedule(...)`) — unit-testable without React Native, reusable by the admin panel's preview.

---

## 9. Third-Party Services Summary

| Service | Tier | Annual cost | Limit that matters |
|---|---|---|---|
| Supabase | Free | £0 | 500MB DB / 1GB storage / project pauses after 7 idle days (daily app traffic prevents this; add an uptime ping as belt-and-braces) |
| OneSignal | Free | £0 | Unlimited **mobile** push subscribers/sends on Free (the 10k cap applies to web push, which we don't use) |
| Sentry | Free | £0 | 5k errors/mo |
| PostHog (EU) | Free | £0 | 1M events/mo |
| Cloudflare Pages | Free | £0 | — |
| EAS Build/Update | Free | £0 | ~30 builds/mo; EAS Update free tier MAU cap |
| Apple Developer | Afom Solutions' existing account | £0 incremental | Renewal already paid for Unstuck; no new account needed |
| Google Play | Afom Solutions' existing account | £0 incremental | One-off fee already paid |
| **Total incremental running cost** | | **£0/yr** | Every service on a free tier; the only future cost trigger is outgrowing Supabase Free (500MB DB / 1GB storage) — unlikely for a single-mosque content app if gallery images are resized on upload |

**Cost-minimisation rules baked into the build:** images resized client-side in the admin panel before upload (keeps Storage under 1GB); PostHog/Sentry sampling configured conservatively; no paid tier is ever required for correct operation, only for scale.

---

## 10. Security Considerations

- **RLS default-deny** on every table; anon key can only read published content. Verified by automated policy tests in CI (`supabase test db`).
- **Zero user-PII by design.** With the scholar form cut, the app collects no user-entered personal data at all — no forms, no accounts, no public write endpoints. GDPR exposure reduces to telemetry (Sentry crash data, anonymised PostHog events) and the OneSignal push token, all covered by a short privacy policy. This also empties Apple's "data used to track you" questions.
- **No secrets in the app binary** beyond the anon key (designed to be public). OneSignal REST key and service role key live only in Supabase Edge Function secrets. EAS secrets for build-time config.
- **Admin panel:** invite-only Supabase Auth, `admin` role claim enforced in RLS (never client-side only), session expiry, Cloudflare Access optionally in front for defence-in-depth.
- **Push composer is authenticated server-side** (`send-push` checks the JWT role) — a leaked admin-panel bundle exposes nothing sendable.
- **Store compliance (publishing under Afom Solutions Pvt Ltd):** the app must be **free** and donations must **only** be collected outside the app (link-out to the masjid's web donation page opens in the browser, not an in-app payment sheet) — this is Apple's explicit rule for fundraising apps whose publisher is not an approved nonprofit (guideline 3.2.1(vi)/3.2.2). No fake/dead-end payment UI. App Review notes must state: custom-built (not a template service), on behalf of registered charity no. 285630, donations collected on the charity's own website. Privacy nutrition labels: diagnostics (Sentry) and usage data (PostHog) only — no user-provided data is collected; App Tracking Transparency not required since no cross-app tracking. Note the store listing will show "Afom Solutions Pvt Ltd" as developer; put "Official app of Wembley Central Masjid" prominently in the listing copy.
- **Supply chain:** pnpm lockfile, Dependabot, no networking beyond the four declared services.
- **Location data** (Qibla) is used on-device only and never transmitted — say so in the permission rationale and privacy policy.

---

## 11. Development Roadmap (9 weeks, matching the proposal)

| Milestone | Weeks | Deliverables | Exit criteria |
|---|---|---|---|
| **M0 — Foundations** | 1 | Monorepo, Expo app skeleton with Expo Router tabs matching the prototype IA, theme tokens ported from `style.css`, Supabase project + migrations + seed data, CI green | App boots with themed tab bar; DB schema deployed |
| **M1 — Prayer core** (this milestone IS the product) | 2–4 | Timetable ingestion + home widget + real countdown + monthly screen; Hijri w/ offset; local notification scheduling + per-prayer toggles; **full iqamah-change reliability chain (OneSignal visible + silent push, background fetch)**; admin: CSV import + **quick iqamah editor with automatic change-push** | A test device with the app closed receives the correct alert after an iqamah edit made in the dashboard — demo this to the committee |
| **M2 — Content** | 5–6 | App: events (+detail, calendar, share), news, notices, about/services/madrasah/contact screens. Admin (parallel track, second developer): full CRUD for events, news, banners, notices, gallery, donations, madrasah, services — with draft/publish and phone-frame preview | Masjid staff can publish every content type end-to-end without developer help |
| **M3 — Engagement** | 6–7 | App: remaining notification topics + onboarding flow, Qibla, donate link-out screens. Admin (parallel): push composer + send history, config editor, users/roles + audit log | Push sent from admin panel arrives and deep-links to the right screen |
| **M4 — Hardening** | 7–8 | Sentry, PostHog, accessibility pass, offline/edge-case QA (DST changes!, post-Isha rollover, timetable gaps), Maestro smoke suite, performance (cold start < 2s), store assets, privacy policy. **Notification launch-gate protocol:** device matrix (iPhone + stock Android + one aggressive OEM, e.g. Xiaomi) each held through ① a normal day, ② an iqamah change with the app closed, ③ a force-quit app, ④ a DST transition (simulated); plus a **2-week congregant beta (TestFlight/Play internal) that must span at least one real iqamah change** | Zero P1 bugs; RLS policy tests pass; **zero wrong-time notifications observed in beta** — this criterion gates launch |
| **M5 — Launch** | 9 | Store submissions under **Afom Solutions' existing accounts** (no new-account lead time), review-note prep (charity number, custom build, donation link-out), staged rollout, admin training session + written runbook for staff | Both stores approved; staff publish content unaided |

**DST note for M4:** the UK clock change (late Oct/Mar) is the classic prayer-app bug. Store times as local wall-clock `time` per date (as schemed) and schedule notifications with explicit `Europe/London` handling; add regression tests for both transition days.

---

## 12. Risks, Trade-offs & Cost Estimates

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Apple 4.2.6/4.3 "template app" rejection (common for mosque apps; agency accounts publishing unrelated apps get extra scrutiny) | Medium | Launch delay | Custom-coded (no template service), unique branding, real content at review time, review notes citing charity registration and custom build; donations strictly link-out |
| Content operations lapse (stale timetable is worse than no app) | Medium-high | Trust damage | CSV bulk import 12 months ahead; admin dashboard warns when <30 days of timetable remain; push a monthly "timetable expiring" email to staff |
| Free-tier limits (Supabase pause, EAS queue times) | Low-medium | Availability | Uptime ping; any paid-tier upgrade needs committee sign-off first (the original proposal budgeted up to £409/yr, so there is pre-agreed headroom if ever genuinely needed) |
| Iqamah changed after users cached notifications | High (stated as the app's core problem) | Wrong alert time → missed prayers → app loses trust | Four-layer reliability chain (§4): local schedule + automatic visible change-push + silent reschedule push + daily background fetch + foreground re-sync |
| Magnetometer inaccuracy (Qibla) | Medium | Minor | Accuracy indicator, calibration prompt, static-bearing fallback |
| Scope creep toward Madrasah hub / native payments mid-build | High | Budget blowout | Both explicitly phase 2 in the signed scope; this document is the contract |
| Single developer bus-factor / volunteer burnout | High | Maintenance | Monorepo docs, staff runbook; masjid should own the Supabase + OneSignal accounts even though the store accounts are Afom's; admin dashboard makes content ops self-service so the volunteer isn't a daily dependency |
| App lives under Afom Solutions' store accounts | Accepted | Ownership / phase-2 constraint | Both stores support app transfers preserving users and reviews — documented exit path if the masjid later wants ownership or native in-app donations (which Apple only allows for approved nonprofits) |

**Trade-offs accepted:** no dark mode v1 (tokens ready); no i18n v1 (structure ready); WebView 360° tour instead of native viewer; link-out donations trade conversion for zero payment liability — and while the app is published under Afom Solutions (a for-profit), link-out is also the *only* Apple-compliant donation model, so native Stripe in phase 2 would first require transferring the app to a charity-owned account.

---

## 13. Account Setup Checklist (all free tier)

Register services under a dedicated shared mailbox (e.g. `wcmapp.admin@gmail.com`, credentials shared with the masjid via password manager) with personal accounts invited as members — keeps the masjid in control of its data even though the store accounts are Afom Solutions'.

| Order | Service | Purpose | Setup notes |
|---|---|---|---|
| 1 | Supabase | DB / Storage / Edge Functions / admin auth | ✅ Done — project `wcm-app` under wcm.mobileapp@gmail.com, London region, Data API on, auto-expose off, automatic RLS on |
| 2 | Expo (EAS) | Builds, submission, OTA updates | ✅ Done — organization **`wcm-mobileapp`** (Omar's personal login: `@wcm-app`). App config MUST set `"owner": "wcm-mobileapp"` in `app.json` so the project belongs to the org |
| 3 | Firebase | **FCM only** (Android push transport for OneSignal) | Generate Service Account JSON; nothing else from Firebase is used. ⚠️ **Hard-won gotcha:** the service account needs **two** IAM roles in Google Cloud Console — "Firebase Cloud Messaging API Admin" AND "Firebase Viewer" — and the Firebase Cloud Messaging API must be enabled on the project. Missing any of these makes OneSignal reject the JSON with an unhelpful generic "Invalid request". (Cost a full evening on 11 Jul 2026.) |
| 4 | OneSignal | Remote push | Needs Firebase JSON (#3) + APNs .p8 key from Apple account |
| 5 | Cloudflare | (Held in reserve) custom admin domain + Turnstile login CAPTCHA | Account created; admin currently ships via GitHub Pages instead — revisit at M5 if a branded admin URL is wanted |
| 6 | Sentry | Crashes | Two projects: `wcm-mobile`, `wcm-admin` |
| 7 | PostHog | Analytics + re-sync telemetry | **EU Cloud** at signup |

Existing accounts — tasks, not signups: **Apple Developer** (create bundle ID, generate APNs Auth Key .p8; EAS automates most of it), **Google Play Console** (create app entry; verify org-account status since personal accounts need 20 testers × 14 days before production), **GitHub** (add `EXPO_TOKEN` + Supabase access token as Actions secrets).

**Cost fit (volunteer-led, team-resourced build):** £0 incremental running cost — every service is on a free tier and the store accounts already exist. Development and design capacity is available, so the admin dashboard is built **comprehensively from the start** (full spec in §7) on a parallel track: one workstream on the app, one on the admin panel, sharing `packages/shared` (Zod schemas, generated DB types, prayer-time logic). Sequencing discipline still applies — the notification reliability chain (M1) remains the launch-critical path and gets the strongest engineer; admin modules can trail app screens by a few days without risk. Phase 2 candidates, in recommended order: (1) Ramadan mode activation, (2) Stripe donations + Gift Aid (requires account transfer to the charity), (3) Madrasah parent portal (needs auth + safeguarding policy), (4) home-screen prayer widget, (5) additional languages.
