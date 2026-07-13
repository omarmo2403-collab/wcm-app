# WCM App — Complete Project Context (Handoff Document)

> **Purpose**: everything a new machine + new agent needs to continue this project
> without the original conversation history. Last updated **14 Jul 2026** — both
> stores mid-launch (Play in review; Apple one click from review).
>
> ⚠️ **This repo is PUBLIC** (GitHub Pages serves the admin from it). This document
> deliberately contains **no secrets** — see §9 for the secrets manifest and how to
> carry them to a new machine.

---

## 1. What this is

The official mobile app of **Wembley Central Masjid** (35–37 Ealing Road, Wembley,
UK registered charity **285630**), published by **Afom Solutions Private Limited**
(Omar's company). Volunteer/goodwill project with a hard **£0/month running cost**
constraint (Supabase free tier, GitHub Pages, OneSignal free tier, EAS free tier).

**Mission-critical feature**: notifications. Users must get (a) a local reminder
**15 minutes before every iqamah** they opt into, (b) an instant push when the
Masjid changes an iqamah time, (c) event reminders. A user receiving a **wrong
time** is the fatal failure mode; non-delivery must always be diagnosable.

**The contract**: `docs/REBUILD_PLAN.md` — requirements, notification matrix,
UX rules. §4 was amended 13 Jul 2026 (Omar): the OS notification-permission
dialog fires **immediately on first launch** (originally a soft ask).

**The look**: `prototype/` contains the approved HTML prototype. The app is
pixel-faithful to it (Omar verified screen-by-screen). Do not "improve" visuals
unilaterally; match the prototype.

## 2. Repository map

Monorepo (pnpm workspaces): `https://github.com/omarmo2403-collab/wcm-app` (public).

```
apps/mobile      Expo SDK 57 / RN 0.86 app (expo-router, TypeScript)
apps/admin       Vite + React SPA — the Masjid staff dashboard
packages/shared  Cross-platform domain logic (prayer times, London dates) — has unit tests
supabase/        Migrations (source of truth for schema) + 2 edge functions
docs/            REBUILD_PLAN.md (contract), this file, superpowers/ (design/plan docs)
prototype/       Approved HTML/CSS prototype (visual reference)
scripts/         Helper scripts
store-assets/    ⚠️ GITIGNORED — store listings, screenshots, .aab files (see §9)
.github/         ci.yml (checks) + pages.yml (admin deploy to GitHub Pages)
.easignore       ⚠️ Replaces .gitignore for EAS build archives — keep complete (§8)
```

Key mobile paths:
- `apps/mobile/src/app/` — expo-router routes: `(tabs)/` (index/events/donate/madrasah/more),
  `event/[id]`, `prayer-times`, `qibla`, `news`, `stadium`, `contact`, `about`,
  `services`, `service/[id]`, `notification-settings`, `coming-soon`
- `apps/mobile/src/features/notifications/` — local scheduler, background sync, prefs
- `apps/mobile/src/lib/onesignal.ts` — remote push init, topic tags, deep-link allowlist
- `apps/mobile/app.json` — all Expo config (see §8 for iOS/Android specifics)
- `apps/mobile/credentials/` — ⚠️ GITIGNORED `.p8` keys (see §9)

Key admin paths:
- `apps/admin/src/App.tsx` — nav + **URL-hash routing** (`#section`, `#events/edit/<id>`, `#notifications/sent`)
- `apps/admin/src/sections/` — Timetable, CrudSection (events/news/banners/gallery/services…),
  StadiumDays, SchedulePush (templates), PushComposer, Notifications (queue UI), Config, Audit
- `apps/admin/src/lib/uktime.ts` — ALL admin datetimes are Europe/London wall time (tested)
- `apps/admin/src/lib/queue.ts` — notification_queue client (tested)

Deployed admin: `https://omarmo2403-collab.github.io/wcm-app/` (auto-deploys on push
via pages.yml). Privacy policy: `https://omarmo2403-collab.github.io/wcm-app/privacy.html`.

## 3. Backend (Supabase)

Project ref **`gjffozmcbdtafdsxifyq`** (name "wcm-app", free tier).

**Tables** (live, public schema): `app_config` (key→jsonb; keys incl. `contact`
{phone/email/address — phone MUST stay in international `+44…` format, see §11},
`hijri_offset_days`), `audit_log`, `banners`, `donation_categories`, `events`,
`gallery_images`, `jumuah_times`, `madrasah_classes`, `news`, `notices`,
`notification_queue`, `prayer_times`, `services`, `stadium_days`.

**Auth/RLS**: staff sign in to the admin via magic link; every staff-write policy
goes through `public.is_staff()`. The mobile app reads anon.

**Edge functions** (`supabase/functions/`):
- `send-push` — immediate-only sends: staff JWT required, topic whitelist, length
  caps (title ≤65, message ≤178), published-event deep-link check; logs a `sent`
  row into notification_queue after sending (source whitelist: prayer_change/event/composer).
- `notification-dispatcher` — runs every 5 min via `pg_cron` + `net.http_post`
  guarded by an `x-cron-secret` header; claims due queue rows
  (`claim_due_notifications()` RPC: expires >6h-stale pending rows, `FOR UPDATE
  SKIP LOCKED`, attempts++), sends via OneSignal REST (tag filters), marks
  sent/failed (failed after 3 attempts), prunes rows older than 30 days.

**Migrations are the schema source of truth** — `supabase/migrations/*.sql`,
applied via the Supabase **Management API** `POST /v1/projects/<ref>/database/query`
(see §10 for the curl pattern). The two crown-jewel migrations:
`20260713000002_notification_queue.sql`, `20260713000003_event_custom_reminder_message.sql`.

## 4. The notification system (read this before touching anything)

Two layers, deliberately separate:

**Local (on-device, exact times)** — `apps/mobile/src/features/notifications/`
- expo-notifications scheduled alerts **15 min before each iqamah** (per-prayer
  opt-in, adjustable lead time), synced from the timetable on app start, on
  foreground, and by a daily background task. Sync runs are **serialized** (a
  module-level promise chain) to prevent interleaved cancel/schedule races.
- iOS 64-pending-notification cap respected by the schedule builder.
- **First launch**: OS permission dialog fires ~600ms after Home mounts
  (`NotificationSync`), when status is still `undetermined`. Denied users
  re-enable via the notification-settings screen (deep-links to OS settings).

**Remote (OneSignal, server-decided)** — everything else:
- OneSignal app id `36591c9d-0098-4d2b-bad5-d240719d9285` ("Wembley Central
  Masjid App"). Android FCM **and** Apple APNs (.p8, since 13 Jul) both Active.
- Topic model: users' topic prefs mirror to OneSignal **tags** (`topic='true'/'false'`);
  sends target `tag = 'true' OR not_exists` for default-on topics. Tag writes are
  **delayed ≥5s after init** — early `OneSignal.User` access is an uncatchable
  native crash (MIUI, 11 Jul 2026).
- Deep links: pushes carry `data.route`; the app only navigates to an allowlist
  (`/event/<id>`, `/stadium`, `/prayer-times`, `/news`, `/donate`).

**The queue (single source of truth for scheduled pushes)** — `notification_queue`:
- Columns: source (`event|stadium|template|composer|prayer_change`), source_id,
  title ≤65, message ≤178, topic, route (`/^\//`) or url, `fire_at` (timestamptz),
  status (`pending|sent|failed|canceled|expired`), attempts, sent_at, onesignal_id,
  recipients, error, created_by.
- Dedup: partial unique indexes — one pending per event (`source='event'`), and
  manual sources deduped on `(topic, date_trunc('minute', fire_at AT TIME ZONE 'utc'))`
  (the `AT TIME ZONE 'utc'` pin is required — timestamptz `date_trunc` isn't IMMUTABLE).
- **Events are trigger-driven**: `sync_event_notification` (SECURITY DEFINER) keeps
  exactly one pending queue row per published future event — insert/update/delete,
  recompose text (`compose_event_reminder`, mirrored in TS), retime, cancel on
  unpublish. Per-event overrides: `notify_at` (custom fire time; null = none) and
  `notify_message` (custom body, ≤178, blank → template).
- Admin: **Notifications** section = Upcoming (cancel-able) + Sent (30-day rolling
  log). Events editor has reminder modes (auto/morning/custom/none), a live
  message preview, queue-status line, and a **"Send reminder now"** button
  (confirm → send-push → clears notify_at). Stadium/template/composer sections
  write queue rows via `insertQueued` (23505 = duplicate, surfaced nicely).
- **OneSignal holds ZERO schedules** — everything scheduled lives in the queue
  (this eliminated OneSignal's 30-day scheduling cap and the double-send class of
  bugs). Design + plan docs: `docs/superpowers/specs/2026-07-13-notification-queue-design.md`
  and `docs/superpowers/plans/2026-07-13-notification-queue.md`.

## 5. Store status — Google Play

- Console account **omar.mohd2403@gmail.com** — ⚠️ it's **authuser u/1** in his
  Chrome (u/0 is a different account). Org AFOM `6836385681640576300`, app id
  `4973290623845978224`, package `com.afomsolutions.wcm`.
- **Production Submission 1 sent 13 Jul 2026 08:40 — IN REVIEW** (release
  "9 (1.0.0)" = versionCode 9, full rollout, 176/177 countries).
- Internal testing track `4700990127545937778` also serves 9; tester join link
  `https://play.google.com/apps/internaltest/4700990127545937778`; testers list
  "WCM internal testers" (omar.mohd2403@, wcm.mobileapp@).
- Declarations: exact alarms = **Alarm clock** (truthful — iqamah alarms are core);
  health declaration self-cleared after `android.blockedPermissions` stripped
  `ACTIVITY_RECOGNITION` (both variants) + calendar perms (expo-sensors pedometer
  was pulling them in). Data safety, IARC, target audience 18+ all filed.
- Listing copy + all form answers preserved in `store-assets/PLAY_LISTING.md`.
- Known cosmetic wart: no R8/proguard mapping uploaded (warning only).

## 6. Store status — Apple

- **ASC app record `6790262132`**, bundle `com.afomsolutions.wcm`, SKU `wcm-app`,
  Team **XMCWV24DRX** (AFOM Solutions Private Limited), account omar.mohd2403@gmail.com.
- **Listing 100% complete** (all filled via browser 13 Jul): version-1.0 copy
  (promo/description/keywords/support URL/copyright — master copy in
  `store-assets/APP_STORE_LISTING.md`), review contact (Omar; same contact as the
  Unstuck app), sign-in-required = No, App Information (subtitle "Prayer times,
  alerts & events", Lifestyle + Education, no third-party content), age rating
  **4+**, App Privacy **published** ("Data Not Linked to You": Device ID, Product
  Interaction, Crash, Performance; no tracking → no ATT), price **$0.00 / 175
  countries**. Screenshots: 5 × **1284×2778** in the iPhone 6.5" slot
  (`store-assets/appstore/appstore65-1..5.png`) — that slot REJECTS 1290×2796;
  the 6.9" originals (`appstore-1..5.png`) are kept for an optional Media Manager upload.
- **Identifiers**: App IDs for the app + NSE
  (`com.afomsolutions.wcm.OneSignalNotificationServiceExtension`), both with
  **App Group `group.com.afomsolutions.wcm.onesignal`** attached (created manually
  in the portal — the ASC API **cannot** manage App Groups, browser/cookie session only).
- **Signing** (stored on EAS): distribution cert `2G7Z763CN9` (expires 13 Jul 2027),
  profiles `4LRK662KA9` (app) + `T5824J9CL8` (NSE) — regenerated AFTER the App
  Group attach, so they carry it.
- **APNs**: key **`6W8AX8ZFN7`** "WCM OneSignal APNs" (Sandbox & Production, Team
  Scoped) — uploaded to OneSignal (Apple iOS platform **Active**). The account's
  other key `GP43S6ANDH` is Unstuck's. Max 2 APNs keys per account — both slots
  now used. ⚠️ APNs env/type cannot be changed after creation.
- **TestFlight**: internal group "WCM internal testers" with **automatic
  distribution**, tester omar.mohd2403@gmail.com. Builds 7–10 uploaded
  (**10 = current**, cumulative fixes). Failed buildNumbers 1–6 were consumed by
  signing/upload failures (harmless).
- **Remaining to ship**: Omar fresh-installs build 10 → runs the checklist at the
  bottom of `store-assets/APP_STORE_LISTING.md` → then on the ASC version page:
  select **build 10 → Add for Review → Submit**. (The Add for Review button is
  already enabled.)

## 7. Build & release runbook

**EAS**: project `5113e71d-baa0-4982-8518-a5046bd470ce`, owner account
**wcm-mobileapp** (logged in as wcm.mobileapp@gmail.com). `eas.json`:
`cli.appVersionSource: "remote"`, production profile `autoIncrement: true`,
and `submit.production.ios` carries ascAppId/appleTeamId/**ascApiKey paths**.

**iOS (fully headless once set up — the normal loop):**
```powershell
cd apps/mobile
$env:EXPO_ASC_API_KEY_PATH = "<repo>\apps\mobile\credentials\AuthKey_NBCS2PKB2C.p8"
$env:EXPO_ASC_KEY_ID       = "NBCS2PKB2C"
$env:EXPO_ASC_ISSUER_ID    = "8e4f665f-c380-4f06-a1a7-dfe131462cdb"
$env:EXPO_APPLE_TEAM_ID    = "XMCWV24DRX"
npx -y eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive
```
→ builds (~15 min), auto-submits, Apple processes (~5–10 min), TestFlight
auto-distributes to the internal group. **Use `eas-cli@latest`** — older CLIs
silently skip ASC-key auth paths.

**iOS gotchas (each cost a failed build — don't relearn them):**
1. **First-ever cert creation needs a real TTY** — non-interactive mode can only
   REUSE an existing distribution cert (`SetUpDistributionCertificate.
   runNonInteractiveAsync` is a stub in every eas-cli version). If the cert is
   ever revoked, run `apps/mobile/build-ios.ps1` in a real terminal once
   (password-free via the ASC key; answer Y to generate prompts, **No** to
   "set up Push Notifications" — that would eat an APNs slot).
2. **After any App-ID capability change** (e.g. App Groups): Apple invalidates the
   profiles, but a **non-interactive build silently reuses the stale ones**
   (it never authenticates to Apple to notice). Run one interactive
   `build-ios.ps1` — it detects "no longer valid" and regenerates.
3. **The ASC API cannot attach App Groups** to App IDs — do it in the browser
   portal (Identifiers → app → App Groups → Configure), for BOTH the app and the
   NSE App ID, then see gotcha 2.
4. **`.easignore` REPLACES `.gitignore`** for the build archive. Without it the
   archiver packed gitignored junk (286 MB flaky uploads); with it, 2.7 MB / 3 s.
   If you add new secret file types or big folders, add them to `.easignore` too.
5. `expo prebuild` doesn't run on Windows — validate config with
   `npx expo config --type prebuild` instead; real prebuild happens on EAS's Macs.

**Android:** same pattern, `-p android` (Play track uploads were done manually via
the Console this launch; `eas submit -p android` needs a Play service-account key
that was never created — decide post-launch). Local debugging builds: Android
Studio JDK 21 Gradle release builds work; device testing on the Xiaomi via
`adb push` to Downloads + manual install.

**Versioning**: remote on EAS; failed builds consume numbers — normal, ignore gaps.

## 8. Mobile app config specifics (`apps/mobile/app.json`)

- `ios.icon` → `./assets/images/icon.png` (1024, black WCM skyline on white —
  same design as the Play icon). ⚠️ Never point it back at an Icon Composer
  `.icon` folder unless one is actually designed — the deleted template one
  shipped Expo's default icon to TestFlight.
- `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` (skips export compliance).
- OneSignal NSE via `extra.eas.build.experimental.ios.appExtensions` (target
  `OneSignalNotificationServiceExtension`, app group `group.com.afomsolutions.wcm.onesignal`).
- `android.blockedPermissions`: ACTIVITY_RECOGNITION ×2 + READ/WRITE_CALENDAR
  (libraries re-add them otherwise; Play declarations depend on these staying blocked).
- Plugins: expo-router, expo-splash-screen (explicit imageWidth 300 — legacy splash
  block stretches on iOS), onesignal-expo-plugin (production), expo-notifications,
  expo-location + expo-sensors (Qibla permission wording — on-device only, never
  transmitted), `./plugins/without-expo-fcm.js`.
- `apps/mobile/AGENTS.md`: **read Expo v57 docs** (`docs.expo.dev/versions/v57.0.0`)
  before writing Expo-touching code — APIs moved.
- UI: header is a white 56px bar (brand mark + wordmark) — height pinned to
  `56 + safe-area inset` in `(tabs)/_layout.tsx` because iOS bars are 44pt
  (Android 56dp). Root Stack uses `headerBackButtonDisplayMode: 'minimal'`
  (iOS back label leaked the "(tabs)" folder name). Theme tokens in
  `src/theme/tokens.ts` are ported from the prototype CSS.

## 9. Secrets manifest — what does NOT travel with `git clone`

| Secret | Where it is now | On a new machine |
|---|---|---|
| ASC API key `AuthKey_NBCS2PKB2C.p8` (Admin role!) | `apps/mobile/credentials/` (gitignored) | **Copy the file manually** (USB/password manager). If lost: revoke in ASC → Users and Access → Integrations, create a new Team Key (Admin), update eas.json + env vars. |
| APNs key `AuthKey_6W8AX8ZFN7.p8` | same folder; also live inside OneSignal | Only needed to re-upload to a push provider. If lost AND needed: revoke + create new in developer portal → Keys, re-upload to OneSignal. |
| Supabase Management API token | was in the original agent's local memory | Create a fresh one: supabase.com/dashboard → Account → Access Tokens. |
| Supabase DB password / service_role key | Supabase dashboard → project settings | Read from dashboard when needed (service_role also in edge-function secrets). |
| `CRON_SECRET` (dispatcher guard) | live in `cron.job` (query: `select command from cron.job`) and in edge-function secrets | Recover via SQL, or rotate: set new secret in function env + reschedule cron. Repo copies say `SET-AT-DEPLOY-TIME` on purpose. |
| OneSignal REST API key | Supabase edge-function secrets (send-push, dispatcher) | OneSignal dashboard → Settings → Keys & IDs. |
| `google-services.json` | `apps/mobile/` (tracked — FCM sender config, not secret-critical) | travels with git. |
| `store-assets/` (listings, screenshots, .aab) | gitignored folder on Omar's Desktop machine | **Copy manually** — the listing .md files are the master store copy. |
| Browser sessions (Play u/1, ASC, developer portal, OneSignal, expo.dev) | Omar's Chrome profile "Omar Windows - Personal" | Sign in fresh; Omar does all password/2FA entry himself. |

Never commit: `*.p8`, `*.jks/keystore`, `.env*` — `.gitignore` + `.easignore`
both cover these; keep them in sync.

## 10. Working patterns that matter (for the next agent)

- **Supabase schema changes**: write a migration file in `supabase/migrations/`,
  apply via Management API: `curl -X POST
  https://api.supabase.com/v1/projects/gjffozmcbdtafdsxifyq/database/query
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json"
  --data-binary @file.json` (multi-statement returns only the last result — use
  `DO $$ … RAISE EXCEPTION 'ALL_PASSED' $$` sentinel blocks for assert+rollback
  dry runs). Plain urllib/fetch gets Cloudflare-1010'd; **curl with a file body works**.
- **Admin deploys**: push to main → pages.yml → GitHub Pages. CDN lags: wait for
  the workflow's head_sha, then cache-bust and poll for a marker string before
  concluding a deploy is live.
- **Admin verification as staff**: mint a session via service_role →
  `auth/v1/admin/generate_link` (magiclink) → `auth/v1/verify` → inject the JSON
  into `localStorage['sb-gjffozmcbdtafdsxifyq-auth-token']`.
- **Never send test pushes to real topics** — 18 live subscribers. Live-fire tests
  were done against throwaway events with tight windows; prefer the queue's
  pending rows + cancel.
- **UK time everywhere in admin code** — use `lib/uktime.ts` (`Intl` Europe/London,
  `hour12: true` for Node/browser parity); never local-machine time. Tests exist.
- **Phone numbers in data**: always international format (`+44 …`) — iOS resolves
  national `0…` numbers against the DEVICE's region (an India-region iPhone dialed
  +91 before this was fixed in `app_config.contact`).
- **Message length caps**: title ≤65, body ≤178 — enforced in DB constraints,
  edge functions, and admin UI. Keep all three in sync.
- Conventions: commit style is scoped + explanatory (see `git log`), comments
  explain WHY (crash lessons, plan references), match surrounding idiom. CI must
  stay green (`ci.yml`: typecheck + tests + lint).

## 11. Current open state (as of 14 Jul 2026, morning UK)

1. **Play**: Submission 1 in review since 13 Jul 08:40 — nothing to do but wait
   (24–72h typical). On approval: app goes live automatically (full rollout).
2. **Apple**: build **10** (cumulative: real icon, header fit, first-launch
   permission prompt, +44 dialing fallback, chevron-only back button) is on
   TestFlight. **Waiting on Omar's fresh-install verification** of build 10 —
   his last screenshots ("(tabs)" back label, placeholder icon on the TestFlight
   page) were from build 9 / TestFlight page caching; the build-10 IPA was
   downloaded and verified to contain the AppIcon assets. After his OK →
   ASC version page → select build 10 → **Add for Review → Submit**.
3. **Live services**: notification queue running in production (dispatcher every
   5 min); today's event reminders flow through it. Admin fully deployed.
4. Three commits may be unpushed on the original machine — `git log origin/main..HEAD`
   there, or trust GitHub as truth from the new machine.

## 12. Post-launch backlog

- **PostHog**: privacy policy + App Privacy declare Product Interaction analytics,
  but PostHog isn't wired in the app yet (`src/lib/analytics.ts` is the stub) —
  either wire it or trim the privacy policy + store declarations. Decide within
  days of launch, not months.
- Play: upload R8/proguard mapping (cosmetic); consider a Play service-account
  key for `eas submit -p android`.
- Apple: optional 6.9" screenshots via Media Manager; optional Icon Composer
  liquid-glass icon (design one properly first); consider rotating APNs key
  `6W8AX8ZFN7` at leisure (its file briefly transited an agent session log).
- App: Donate tab currently opens the Masjid website externally (guideline 3.2.1
  compliant — keep it that way); "coming-soon" screen exists for future features.
- Watch first-week Sentry for iOS-specific crashes (the Android launch surfaced
  MIUI-specific OneSignal timing issues; iOS may have its own).

## 13. Accounts directory (no secrets)

| What | Identifier |
|---|---|
| Google Play Console | omar.mohd2403@gmail.com (**authuser u/1**), AFOM org 6836385681640576300 |
| Apple Developer + ASC | omar.mohd2403@gmail.com, Team XMCWV24DRX, ASC app 6790262132 |
| Expo/EAS | account **wcm-mobileapp** (wcm.mobileapp@gmail.com), project 5113e71d-baa0-4982-8518-a5046bd470ce |
| Supabase | project ref gjffozmcbdtafdsxifyq |
| OneSignal | app 36591c9d-0098-4d2b-bad5-d240719d9285 |
| GitHub | omarmo2403-collab/wcm-app (public), Pages = admin + privacy policy |
| Sentry | wired via `@sentry/react-native` (`src/lib/sentry.ts`) |
| Contact emails | masjid: wembleycentralmasjid@gmail.com · app: wcm.mobileapp@gmail.com |
