# GNI - Gas Networks Ireland Dashboard

## Project Overview
SvelteKit app (Svelte 5 with runes) hosted on **Vercel**. Displays gas survey reports synced from ArcGIS → PocketBase. Uses PocketBase as the backend.

## Architecture

### Hosting
- **Frontend**: SvelteKit on Vercel
- **Backend**: PocketBase at `https://g.zaur.app` (on VPS)
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
- `/arcgis/src/gas-networks-sync.js` — Main GNI sync logic (55K lines)
- `/arcgis/src/gas-networks-scheduler-safe.js` — PM2-managed scheduler with SIGUSR1/SIGUSR2 signal handlers
- `/arcgis/src/gas-networks-config.js` — GNI layer config
- `/arcgis/src/wwu-sync.js` — Wales & West Utilities sync
- `/arcgis/src/wwu-scheduler-safe.js` / `wwu-config.js` — WWU scheduler + config
- `/arcgis/src/sync-webhook.js` — HTTP webhook for manual sync triggers (port 8095, signal-based)
- `/arcgis/src/auth.js` / `config.js` — Shared auth + legacy PSG config
- `/arcgis/src/scheduler.js` — Legacy PSG scheduler (still running in PM2)
- `/arcgis/src/fix-gni-report-stats.js` — Report stats recalculation (runs after sync when records created)
- `/arcgis/.env` — ArcGIS + PocketBase credentials
- `/arcgis/src/logs/` — Sync logs
- `/arcgis/src/_archive/` — 40 archived dead scripts (check-*, fix-*, old sync-*.js, etc.)

### Key VPS Services
- `pocketbase4.service` — PocketBase (systemd, port 8094, proxied via nginx)
- `sync-webhook.service` — Webhook server (systemd, port 8095, proxied at `g.zaur.app/webhook/`)
- **PM2-managed** (`pm2 list`):
  - `gas-networks-scheduler` — GNI sync scheduler
  - `wwu-scheduler` — WWU sync scheduler
  - `arcgis-sync-scheduler` — Legacy PSG scheduler
- Lock files: `/tmp/gas-networks-sync.lock`, `/tmp/wwu-sync.lock`

### Sync Schedule (GNI)
- Business hours (6-17): every hour at :20
- Off-hours: every 3h at :20
- Force full sync: 2:20 AM and 10:20 AM daily

### Manual Sync Trigger
Signal-based system (no lock conflicts with running scheduler):
1. App UI → `POST /api/v1/trigger-sync` (SvelteKit endpoint, admin-only)
2. SvelteKit → `POST https://g.zaur.app/webhook/trigger` (authenticated with `SYNC_WEBHOOK_SECRET`)
3. Webhook reads scheduler PID from lock file → sends `SIGUSR1` (quick) or `SIGUSR2` (force full)
4. Scheduler receives signal → runs sync within its own process

## Project Structure
- `src/routes/(app)/` — Main app routes (dashboard, reports, admin-tools, etc.)
- `src/routes/(auth)/` — Auth routes (login, logout, forgot-password)
- `src/routes/api/v1/` — Server API endpoints
- `src/lib/components/` — Shared components
- `src/lib/report-utils.ts` — Shared report deduplication & deletable detection logic
- `src/lib/pocketbase.ts` — PocketBase client + API helpers
- `src/lib/realtime.ts` — Real-time subscriptions via PocketBase SSE
- `src/lib/styles/` — Global CSS (theme, tables, cards, etc.)

## Key Collections (PocketBase)
- `gas_reports` — Survey reports (layer 0)
- `driving_sessions` — Survey sessions (layer 6)
- `breadcrumbs` — GPS breadcrumbs (layer 7)
- `indications` — LISA indications (layer 1)
- `field_of_view` / `field_of_view_gaps` — FOV data (layers 2, 3)
- `sync_status` — Per-layer sync tracking

## Auth
- Cookie-based auth via PocketBase (`hooks.server.ts`)
- `locals.user` and `locals.isAdmin` set per request
- Admin check: `role === 'admin'` on user record

## Environment Variables
See `.env` for all config. Key ones:
- `PUBLIC_POCKETBASE_URL` — PocketBase URL
- `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — PB admin creds
- `SYNC_WEBHOOK_SECRET` — Shared secret for webhook auth
- `VPS_HOST` / `VPS_USER` / `VPS_PASSWORD` — VPS SSH access

When deploying to Vercel, `SYNC_WEBHOOK_SECRET` must be added as an environment variable.

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

---

### ⚠️ Could Be Better

**Giant page components**
`reports/+page.svelte` is 2,136 lines (828 script + 796 style + 512 template). `extraction-upload/+page.svelte` is 2,464 lines. These should be broken into smaller components:
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
31 `any` casts in the reports API alone. PocketBase records are typed as `any` throughout. Should define proper interfaces for each collection (gas_reports, driving_sessions, indications, etc.).

**47 TypeScript errors, 208 warnings**
Pre-existing `svelte-check` errors in `Tests.svelte` (undefined `stats`), `settings/+page.svelte` (type mismatch), and several files with implicit `any` parameters. These should be fixed to catch real regressions.

**Console logging in production**
321 `console.log/warn/error` calls across the codebase. Should use a proper logger that can be silenced in production, or at minimum use `$app/environment`'s `dev` flag.

**No tests**
Zero test files. No unit tests, no integration tests, no e2e tests. Critical business logic (deduplication, stats calculation, deletable detection) should have unit tests at minimum.

**Duplicate stats logic**
`/api/v1/reports` and `/api/v1/archive-reports` have nearly identical stats calculation code. Should be extracted into a shared `calculateReportStats()` function.

**~~Client-side data fetching in reports page~~ ✅ FIXED**
Reports page now uses server-side loading with streaming via `+page.server.ts`, matching the dashboard pattern. Data starts loading on the server; page renders immediately with skeletons. Client-side `loadData()` retained for manual refresh and survey filter toggle.

**~~Sync status reads from `gas_reports.last_sync`~~ ✅ FIXED**
Sync-status endpoint now reads from the `sync_status` collection (`layer_id=999`, overall sync record) instead of scanning `gas_reports.last_sync`. Also reordered VPS sync script to update `sync_status` + `last_sync` before the slow relationship update step.

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
If a PM2 process crashes in a loop (restart count was 15 for GNI during our session), nobody is notified. If the VPS runs out of memory (sync processes use 100-300MB each), syncs silently fail. **Fix: add PM2 monitoring alerts, or a simple healthcheck endpoint that the app can display.**

**No backup strategy for PocketBase data**
`/root/backups/zaur-app/` exists but appears stale (last entry October). If PocketBase data corrupts or the VPS dies, all report data is lost. ArcGIS is the source of truth, but re-syncing 800+ reports with breadcrumbs would take hours/days. **Fix: automated daily PocketBase backups (it supports `pb backup create`), offsite copy.**

---

### Priority Fixes (Recommended Order)
1. ~~**Remove hardcoded webhook secret**~~ ✅ Done — still need to rotate secret on Vercel + VPS
2. **Add PocketBase backup cron** — data safety, 15 min
3. **Fix TypeScript errors** — code quality, prevents regressions
4. **Break up giant components** — maintainability, biggest productivity win
5. **Add unit tests for report-utils.ts** — business logic correctness
6. **Extract shared stats calculation** — DRY, fewer bugs
7. **Stop running as root on VPS** — security hardening
