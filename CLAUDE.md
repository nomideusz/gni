# GNI - Gas Networks Ireland Dashboard

## Project Overview
SvelteKit app (Svelte 5 with runes) hosted on **Vercel**. Displays gas survey reports synced from ArcGIS → PocketBase. Uses PocketBase as the backend.

## Architecture

### Hosting
- **Frontend**: SvelteKit on Vercel
- **Backend**: PocketBase v4 at `https://g.zaur.app` (on VPS)
- **Sync scripts**: Node.js on VPS, syncing ArcGIS → PocketBase

### VPS Access (ps2)
Credentials are in `.env` (`VPS_HOST`, `VPS_USER`, `VPS_PASSWORD`).

**SSH via Python (paramiko)**:
```python
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.42.177.36', username='root', password='szczerzuja')
stdin, stdout, stderr = ssh.exec_command('your-command-here')
print(stdout.read().decode())
ssh.close()
```

Or via `sshpass` (installed on this machine):
```bash
sshpass -p 'szczerzuja' ssh -o StrictHostKeyChecking=no root@100.42.177.36 'command'
```

### Key VPS Paths
- `/opt/pocketbase4/` — PocketBase binary (v4), serves `g.zaur.app` on port 8094
- `/arcgis/` — All sync scripts (Node.js, ES modules)
- `/arcgis/.env` — ArcGIS + PocketBase credentials
- `/arcgis/src/logs/` — Sync logs (also `/arcgis/logs/` for PM2 stdout/stderr)
- `/arcgis/src/_archive/` — 40 archived dead scripts

#### Active VPS Scripts (11 files in `/arcgis/src/`)
| Script | Purpose |
|--------|---------|
| `gas-networks-sync.js` | Main GNI sync logic (~56K lines). Syncs 12 ArcGIS layers → PocketBase. Contains `updateGasNetworksRelationships()` and `updateGasNetworksBreadcrumbStatistics()`. |
| `gas-networks-scheduler-safe.js` | PM2-managed GNI scheduler. Signal handlers: SIGUSR1=quick, SIGUSR2=force. Runs `fix-gni-report-stats.js` after sync when new records created. |
| `gas-networks-config.js` | GNI ArcGIS layer definitions (12 layers, IDs, field mappings) |
| `wwu-sync.js` | Wales & West Utilities sync (~50K lines) |
| `wwu-scheduler-safe.js` | PM2-managed WWU scheduler |
| `wwu-config.js` | WWU layer config |
| `sync-webhook.js` | HTTP webhook server (port 8095). Reads PID from lock file, sends SIGUSR1/2 to scheduler. |
| `scheduler.js` | Legacy PSG scheduler (still running in PM2 as `arcgis-sync-scheduler`) |
| `auth.js` | Shared ArcGIS token management |
| `config.js` | Legacy PSG ArcGIS config |
| `fix-gni-report-stats.js` | Recalculates report statistics for all reports. Spawned as separate Node process by scheduler. |

### Key VPS Services
- `pocketbase4.service` — PocketBase (systemd, port 8094, proxied via nginx)
- `sync-webhook.service` — Webhook server (systemd, port 8095, proxied at `g.zaur.app/webhook/`)
- **PM2-managed** (`pm2 list`):
  - `gas-networks-scheduler` → `gas-networks-scheduler-safe.js` (fork mode)
  - `wwu-scheduler` → `wwu-scheduler-safe.js` (fork mode)
  - `arcgis-sync-scheduler` → `scheduler.js` (cluster mode, legacy)
- Lock files: `/tmp/gas-networks-sync.lock` (contains scheduler PID), `/tmp/wwu-sync.lock`
- PM2 logs: `/arcgis/logs/gas-networks-scheduler-out.log`, `*-error.log`

### Sync Flow (GNI)

#### Schedule
- Business hours (6-17): every hour at :20
- Off-hours: every 3h at :20
- Force full sync: 2:20 AM and 10:20 AM daily

#### What a sync does
1. **Authenticate** with ArcGIS (token in `/arcgis/.env`)
2. **Sync 12 layers** sequentially (layer 0=Reports, 6=Sessions, 7=Breadcrumbs, 1=Indications, 2-3=FOV, 4-5=Pipes, 8=Field Notes, 9=Investigations, 10=Gas Leaks, 11=Other Sources)
   - Incremental: fetches only records with `last_edited_date >= today`
   - Force: fetches ALL records, performs deletions
   - Each layer updates its `sync_status` record to `in_progress` → `success`/`failed`
3. **Update sync timestamps** — overall `sync_status` (layer_id=999) + `last_sync` on most recent `gas_report` (for backward compat)
4. **Relationship update** (only when `totalCreated > 0` or force sync):
   - Links reports ↔ sessions, FOV, gaps, notes, indications
   - Links sessions ↔ breadcrumbs
   - Links indications ↔ investigations, pipes
   - Filtered to records since 2026-03-01 (using `last_edited_date` for reports, `last_sync` for others)
5. **Breadcrumb statistics** (same condition as #4):
   - Recalculates `total_duration_seconds`, `total_length_meters` per driving session
   - Aggregates session stats to parent reports
   - Also filtered to records since 2026-03-01
6. **Stats fix** (`fix-gni-report-stats.js`, same condition): Recalculates all report statistics as separate Node process

#### Performance characteristics
- **Incremental sync (no new records)**: ~2 min. Steps 4-6 are skipped entirely.
- **Incremental sync (new records created)**: ~5-20 min depending on count. Steps 4-6 run but filtered to recent records only.
- **Force full sync**: 30-60+ min. Steps 4-6 process all records (still date-filtered to 2026-03-01+).
- Layer 7 (Breadcrumbs) is the slowest layer: 1.6M records in PocketBase, ~4000 features per incremental sync.

#### Data volumes (as of April 2026)
- `gas_reports`: 829 records
- `driving_sessions`: 9,642 records
- `breadcrumbs`: 1,637,240 records
- `indications`: 736 records
- `field_of_view_gaps`: 63,896 records
- `field_of_view`: 1,036 records
- `field_notes`: 40,298 records
- `investigations`: 20,093 records
- `gas_leaks`: 10,114 records
- `other_sources`: 560 records

### Manual Sync Trigger
Signal-based system (no lock conflicts with running scheduler):
1. App UI → `POST /api/v1/trigger-sync` (SvelteKit endpoint, admin-only)
2. SvelteKit → `POST https://g.zaur.app/webhook/trigger` (authenticated with `SYNC_WEBHOOK_SECRET`)
3. Webhook reads scheduler PID from lock file → sends `SIGUSR1` (quick) or `SIGUSR2` (force full)
4. Scheduler receives signal → runs sync within its own process
5. If sync already running → logs "already running, skipping" (no queue)
6. Frontend polls `/api/v1/sync-status` every 3s during sync, shows layer progress

### PocketBase Details
- **Version**: 4 (v4 API — uses `_superusers` for admin auth, not `/api/admins/`)
- **Admin auth**: `b.dymet@gmail.com` / `Szczerzuj1a!` (superuser collection)
- **User auth**: Regular users in `users` collection (e.g., `bdymet@picarro.com`). 9 users total.
- **Collection API rules**: Most collections use `@request.auth.id != ""` for list/view (any authenticated user). `sync_status` also has this rule. Write operations are superuser-only.
- **Auto-fields**: PB4 has `created`/`updated` on all records, but they are **NOT filterable** via the API. Use collection-specific date fields instead (`last_edited_date`, `last_sync`, `report_date`, etc.).
- **Data dir**: `/opt/pocketbase4/pb_data/`

## Project Structure
- `src/routes/(app)/` — Main app routes (dashboard, reports, admin-tools, etc.)
- `src/routes/(app)/+page.server.ts` — Dashboard server-side load (streaming)
- `src/routes/(app)/reports/+page.server.ts` — Reports server-side load (streaming)
- `src/routes/(auth)/` — Auth routes (login, logout, forgot-password)
- `src/routes/api/v1/` — Server API endpoints
  - `reports/` — Main reports data + stats (487 lines, does too much)
  - `sync-status/` — Reads from `sync_status` collection (layer_id=999), detects in-progress syncs
  - `trigger-sync/` — Admin-only, proxies to VPS webhook. Uses `$env/dynamic/private` for secret.
- `src/lib/components/` — Shared components
  - `RealtimeIndicator.svelte` — Live status pill, sync time, progress during sync, Quick/Full Sync buttons (admin)
- `src/lib/report-utils.ts` — Shared report deduplication & deletable detection logic
- `src/lib/pocketbase.ts` — PocketBase client + API helpers
- `src/lib/realtime.ts` — Real-time subscriptions via PocketBase SSE
- `src/lib/styles/` — Global CSS (theme, tables, cards, etc.)

## Key Collections (PocketBase)
| Collection | Layer | Records | Key date fields |
|------------|-------|---------|-----------------|
| `gas_reports` | 0 | 829 | `report_date`, `last_edited_date`, `last_sync` |
| `driving_sessions` | 6 | 9,642 | `survey_start_datetime`, `survey_end_datetime`, `last_sync`, `stats_updated_at` |
| `breadcrumbs` | 7 | 1,637,240 | (none filterable — just `driving_session_id`) |
| `indications` | 1 | 736 | `last_sync` |
| `field_of_view` | 2 | 1,036 | `last_sync` |
| `field_of_view_gaps` | 3 | 63,896 | `last_sync` |
| `investigations` | 9 | 20,093 | (no date fields) |
| `sync_status` | — | 13 | `last_sync_attempt`, `last_sync_success` (layer_id=999 is overall) |

## Auth
- Cookie-based auth via PocketBase (`hooks.server.ts`)
- `locals.pb` — PocketBase client instance, authed from cookie (regular user, not superuser)
- `locals.user` and `locals.isAdmin` set per request
- Admin check: `role === 'admin'` on user record

## Environment Variables
See `.env` for all config. Key ones:
- `PUBLIC_POCKETBASE_URL` — PocketBase URL
- `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — PB superuser creds (used by sync scripts, not by frontend)
- `SYNC_WEBHOOK_SECRET` — Shared secret for webhook auth (must be set in Vercel env vars, no fallback)
- `VPS_HOST` / `VPS_USER` / `VPS_PASSWORD` — VPS SSH access

---

## Architecture Review

### ✅ Done Well

**Separation of concerns (Vercel ↔ VPS)**
The frontend on Vercel and backend (PocketBase + sync) on VPS is a clean split. Vercel handles SSR/CDN, VPS handles data. No tight coupling — they communicate only through PocketBase API and the webhook.

**PocketBase as backend**
Good choice for this scale. Single binary, real-time subscriptions via SSE, automatic REST API for all collections, built-in auth. No need for a custom backend.

**Real-time data flow**
`realtime.ts` subscribes to PocketBase SSE for live updates. When ArcGIS data syncs → PocketBase records change → UI auto-refreshes. Debounced (3s) to avoid thrashing.

**Cookie-based auth with server-side validation**
`hooks.server.ts` validates auth on every request, refreshes tokens, sets `locals.user`/`locals.isAdmin`. Cookies are httpOnly, preventing XSS token theft.

**Design system foundation**
Good CSS organization with `src/lib/styles/` (theme.css, tables.css, cards.css, etc.) and reusable components (PageTemplate, SectionContainer, ReportsFilters, etc.).

**Shared report logic (`report-utils.ts`)**
Centralized deduplication and deletable detection used by both API endpoints and the reports UI. Single source of truth for base-title extraction and pattern matching.

**i18n support**
`i18n.ts` with typed translation keys. Currently English-only but the structure is ready for more languages.

**Signal-based sync trigger**
The webhook → SIGUSR1/2 → scheduler approach is elegant: zero lock conflicts, zero extra processes, instant response.

**Server-side data loading with streaming**
Both dashboard (`+page.server.ts`) and reports page use SvelteKit streaming — promises returned from `load()` resolve asynchronously, page renders immediately with skeletons.

**Sync progress in UI**
`RealtimeIndicator` shows real-time sync progress (current layer, X/12 completed), disables trigger buttons during sync, and polls every 3s. Detects in-progress syncs both on page load and after manual trigger.

---

### ⚠️ Could Be Better

**Giant page components**
`reports/+page.svelte` is ~2,100 lines. `extraction-upload/+page.svelte` is 2,464 lines. These should be broken into smaller components:
- Table rendering → `ReportsTable.svelte`
- Sort/filter logic → composable/store
- Export logic → `exportReports.ts` utility
- Styles → extract to shared CSS or component-scoped

**API endpoint doing too much (`/api/v1/reports`)**
The reports endpoint (487 lines) fetches, processes, deduplicates, calculates 20+ statistics, and formats — all in one function. Should be split:
- Data fetching layer
- Stats calculation (could be a shared utility)
- Response formatting

**Dead/commented code**
Two large `/* OLD LOGIC REPLACED */` blocks in `reports/+page.svelte` (~200 lines). Should be removed — git history preserves the old code.

**`any` types everywhere**
31 `any` casts in the reports API alone. PocketBase records are typed as `any` throughout. Should define proper interfaces for each collection.

**47 TypeScript errors, 208 warnings**
Pre-existing `svelte-check` errors in `Tests.svelte` (undefined `stats`), `settings/+page.svelte` (type mismatch), and several files with implicit `any` parameters.

**Console logging in production**
321 `console.log/warn/error` calls across the codebase. Should use a proper logger or `$app/environment`'s `dev` flag.

**No tests**
Zero test files. Critical business logic (deduplication, stats calculation, deletable detection) should have unit tests at minimum.

**Duplicate stats logic**
`/api/v1/reports` and `/api/v1/archive-reports` have nearly identical stats calculation code. Should be extracted into a shared `calculateReportStats()` function.

**Relationship update is still slow when records are created**
Even with the 2026-03-01 date filter, `updateGasNetworksRelationships()` processes ~3000 driving sessions and ~39 reports with N+1 queries. Should track which specific record IDs were created/updated in the sync run and only process those.

**`fix-gni-report-stats.js` recalculates everything**
When it runs (on new records), it re-fetches ALL 829 reports and recalculates their stats. Should be filtered to only reports affected by the current sync run.

---

### 🔴 Critically Bad

**~~Hardcoded webhook secret in source code~~ ✅ FIXED**
`trigger-sync/+server.ts` now uses `$env/dynamic/private` and throws if `SYNC_WEBHOOK_SECRET` is missing. No hardcoded fallback. **Remaining action: rotate the secret on Vercel + VPS since the old value is in git history.**

**Admin credentials in `.env` committed patterns**
While `.env` is gitignored, the PB admin password `Szczerzuj1a!` appears in the `.env` file and was visible in this session. The VPS root password `szczerzuja` is also stored in `.env`. If `.env` ever leaks (backup, copy, teammate), full system access is compromised. **Fix: use a secrets manager or at minimum ensure `.env` is never committed and passwords are rotated.**

**VPS running everything as root**
PocketBase, sync scripts, PM2, webhook — all run as `root`. A compromised sync script = full server access. **Fix: create a dedicated user (e.g., `gni`) with minimal permissions. Run PocketBase and sync scripts under that user.**

**No VPS firewall / rate limiting on webhook**
The webhook at `g.zaur.app/webhook/` is exposed to the internet with only a Bearer token for auth. No rate limiting, no IP allowlist. A brute-force attack on the token or a leaked secret = ability to trigger unlimited syncs. **Fix: add nginx rate limiting (`limit_req`), or restrict to Vercel's IP ranges.**

**Sync scripts have no health monitoring**
If a PM2 process crashes in a loop (restart count was 15+ for GNI), nobody is notified. If the VPS runs out of memory (sync processes use 100-380MB each), syncs silently fail. **Fix: add PM2 monitoring alerts, or a simple healthcheck endpoint that the app can display.**

**No backup strategy for PocketBase data**
`/root/backups/zaur-app/` exists but appears stale (last entry October). If PocketBase data corrupts or the VPS dies, all report data is lost. ArcGIS is the source of truth, but re-syncing 800+ reports with 1.6M breadcrumbs would take hours/days. **Fix: automated daily PocketBase backups (it supports `pb backup create`), offsite copy.**

---

### Priority Fixes (Recommended Order)
1. ~~**Remove hardcoded webhook secret**~~ ✅ Done — still need to rotate secret on Vercel + VPS
2. **Add PocketBase backup cron** — data safety, 15 min
3. **Fix TypeScript errors** — code quality, prevents regressions
4. **Break up giant components** — maintainability, biggest productivity win
5. **Add unit tests for report-utils.ts** — business logic correctness
6. **Extract shared stats calculation** — DRY, fewer bugs
7. **Stop running as root on VPS** — security hardening
8. **Track changed record IDs in sync** — pass created/updated IDs to relationship update + stats fix, avoid reprocessing unchanged records
