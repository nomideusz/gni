# GNI v2 — Project Plan

## Goal
Rebuild the GNI dashboard as a clean, fast, modern SvelteKit app.
Replace the current PocketBase + VPS + Vercel setup with a single Railway deployment.
Eliminate the 55K-line sync script, the $5/month Contabo VPS, and all the ops overhead.

## Stack
| Component | Technology | Where |
|-----------|-----------|-------|
| Frontend + API | SvelteKit (Svelte 5) | Railway |
| Database | Postgres | Railway |
| Sync | SvelteKit cron endpoint or Railway cron | Railway |
| ORM | Drizzle | — |
| **Total cost** | | **~$5/month Railway Hobby** |

## Why this works

### Current problems
- PocketBase schema doesn't match ArcGIS → 55K-line sync script to map/transform
- Sync rebuilds relationships post-sync (30-60 min) because PB schema lost them
- 1.6M breadcrumbs stored locally, only used for aggregated stats
- VPS ops: PM2, systemd, nginx, lock files, signal handlers, no monitoring, no backups
- Data duplicated 2-4x in PocketBase vs ArcGIS source

### What we discovered
- ArcGIS supports **server-side aggregation** queries (GROUP BY, SUM, COUNT)
- Breadcrumb stats per report: **1.4s** via aggregation (no need to store 660K rows)
- Breadcrumbs already contain `reportid`, `drivingsessionid` — relationships are denormalized
- All reports (no geometry): **344ms**. All indications: **322ms**.
- Fetching IDs for deletion detection: **<1s per layer**
- Real data volumes: 417 reports, 3410 sessions, 363 indications (much smaller than PB copy)

## Database Schema

### Core tables (Phase 1)

```sql
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,  -- ArcGIS reportid (UUID)
  name              TEXT NOT NULL,
  title             TEXT NOT NULL,
  report_date       TIMESTAMPTZ,
  report_type       TEXT,
  is_final          BOOLEAN DEFAULT FALSE,
  region            TEXT,
  created_by        TEXT,
  labels            TEXT,
  -- Asset coverage (from ArcGIS layer 0)
  dist_mains_length          REAL,
  dist_mains_covered_length  REAL,
  dist_mains_coverage        REAL,
  linear_asset_length        REAL,
  linear_asset_covered_length REAL,
  linear_asset_coverage      REAL,
  -- Pre-aggregated stats (computed during sync via ArcGIS aggregation)
  total_duration_seconds  REAL DEFAULT 0,
  total_distance_meters   REAL DEFAULT 0,
  breadcrumb_count        INTEGER DEFAULT 0,
  -- Counts (computed during sync)
  indication_count   INTEGER DEFAULT 0,
  fov_gap_count      INTEGER DEFAULT 0,
  session_count      INTEGER DEFAULT 0,
  -- Vehicle info (most common vehicle from sessions)
  surveyor_unit_desc TEXT,
  -- Metadata
  arcgis_last_edited TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id                     TEXT PRIMARY KEY,  -- drivingsessionid
  report_id              TEXT REFERENCES reports(id) ON DELETE CASCADE,
  surveyor_unit_desc     TEXT,
  survey_start           TIMESTAMPTZ,
  survey_end             TIMESTAMPTZ,
  stability_class        TEXT,
  survey_tag             TEXT,
  -- Pre-aggregated from breadcrumbs during sync
  total_duration_seconds REAL DEFAULT 0,
  total_distance_meters  REAL DEFAULT 0,
  breadcrumb_count       INTEGER DEFAULT 0,
  arcgis_last_edited     TIMESTAMPTZ,
  synced_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE indications (
  id                 TEXT PRIMARY KEY,  -- GlobalID
  report_id          TEXT REFERENCES reports(id) ON DELETE CASCADE,
  lisa_id            TEXT,
  indication_type    TEXT,
  amplitude          REAL,
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  arcgis_last_edited TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fov_gaps (
  id                 TEXT PRIMARY KEY,  -- GlobalID
  report_id          TEXT REFERENCES reports(id) ON DELETE CASCADE,
  gap_id             TEXT,
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  arcgis_last_edited TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sync_log (
  id              SERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT,  -- 'success', 'failed'
  duration_ms     INTEGER,
  reports_upserted  INTEGER DEFAULT 0,
  sessions_upserted INTEGER DEFAULT 0,
  records_deleted   INTEGER DEFAULT 0,
  error_message     TEXT
);

-- Indexes
CREATE INDEX idx_reports_date ON reports(report_date DESC);
CREATE INDEX idx_reports_final ON reports(is_final);
CREATE INDEX idx_sessions_report ON sessions(report_id);
CREATE INDEX idx_indications_report ON indications(report_id);
CREATE INDEX idx_fov_gaps_report ON fov_gaps(report_id);
```

### Extension tables (future phases)

```sql
-- Investigations (ArcGIS layer 9)
CREATE TABLE investigations (
  id              TEXT PRIMARY KEY,
  report_id       TEXT REFERENCES reports(id) ON DELETE CASCADE,
  indication_id   TEXT REFERENCES indications(id),
  lisa_gap_id     TEXT,
  -- fields from layer 9
  arcgis_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Gas Leaks (ArcGIS layer 10)
CREATE TABLE gas_leaks (
  id                TEXT PRIMARY KEY,
  investigation_id  TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  lisa_gap_id       TEXT,
  arcgis_last_edited TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Field Notes (ArcGIS layer 8)
CREATE TABLE field_notes (
  id          TEXT PRIMARY KEY,
  report_id   TEXT REFERENCES reports(id) ON DELETE CASCADE,
  -- fields from layer 8
  arcgis_last_edited TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Other Sources (ArcGIS layer 11)
CREATE TABLE other_sources (
  id                TEXT PRIMARY KEY,
  investigation_id  TEXT REFERENCES investigations(id) ON DELETE CASCADE,
  lisa_gap_id       TEXT,
  arcgis_last_edited TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

-- GIS geometry (when ready for maps)
-- Requires: CREATE EXTENSION postgis;
-- ALTER TABLE reports ADD COLUMN geom geometry(Polygon, 4326);
-- ALTER TABLE indications ADD COLUMN geom geometry(Point, 4326);
```

Adding a new ArcGIS layer = 1 new table + ~10 lines in the sync script.

## Sync Logic

### How it works (~200 lines total)

```
Every hour (Railway cron → POST /api/sync):

1. Authenticate with ArcGIS (get token)

2. For each layer [reports, sessions, indications, fov_gaps]:
   a. Fetch ALL IDs from ArcGIS (returnGeometry=false, outFields=id_field)
   b. Fetch ALL IDs from Postgres
   c. DELETE from Postgres where ID not in ArcGIS (catches deletions)
   d. Fetch records where last_edited_date >= last_sync (returnGeometry=false)
   e. UPSERT changed records into Postgres

3. Aggregate breadcrumb stats from ArcGIS:
   a. Per report: SUM(durationseconds), SUM(lengthmeters), COUNT(*) GROUP BY reportid
   b. Per session: same GROUP BY drivingsessionid
   c. UPDATE reports/sessions with aggregated values

4. Update computed counts:
   UPDATE reports SET
     indication_count = (SELECT COUNT(*) FROM indications WHERE report_id = reports.id),
     fov_gap_count = (SELECT COUNT(*) FROM fov_gaps WHERE report_id = reports.id),
     session_count = (SELECT COUNT(*) FROM sessions WHERE report_id = reports.id);

5. Log to sync_log

Total time: ~5-10 seconds
```

### Deletion detection (guarantees accuracy)
- Every sync fetches ALL IDs from ArcGIS for each layer
- Compares with Postgres IDs
- Any ID in Postgres but not in ArcGIS → DELETE
- Foreign keys with CASCADE handle child records automatically
- Numbers are always exactly in sync with ArcGIS source of truth

### ArcGIS API queries used

| Purpose | Layer | Query type | Time |
|---------|-------|-----------|------|
| All report IDs | 0 | returnGeometry=false, outFields=reportid | 645ms |
| Changed reports | 0 | where=last_edited_date>=X, all fields, no geom | 344ms |
| All session IDs | 6 | paginated, returnGeometry=false | 864ms |
| Changed sessions | 6 | where=last_edited_date>=X, no geom | ~500ms |
| Indication IDs + data | 1 | all, returnGeometry=false | 325ms |
| FOV gap counts by report | 3 | aggregation query | ~500ms |
| Breadcrumb stats by report | 7 | aggregation: SUM, COUNT, GROUP BY | 1,400ms |
| Breadcrumb stats by session | 7 | aggregation: SUM, COUNT, GROUP BY | ~1,000ms |
| **Total** | | | **~5s** |

## SvelteKit App Structure

```
src/
  lib/
    server/
      db.ts              -- Drizzle client + connection
      schema.ts           -- Drizzle schema (mirrors Postgres tables)
      arcgis.ts           -- ArcGIS REST API client (token management, queries)
      sync.ts             -- Sync logic (~200 lines)
    components/
      RealtimeIndicator.svelte
      ReportsTable.svelte
      StatsCards.svelte
      ReportsFilters.svelte
      ExportControls.svelte
      LisaModal.svelte
    utils/
      format.ts           -- Date/number formatting
      export.ts           -- Excel export logic
  routes/
    (auth)/
      login/
      logout/
    (app)/
      +layout.server.ts   -- Auth guard
      +page.server.ts     -- Dashboard: aggregate queries on Postgres
      +page.svelte        -- Dashboard UI
      reports/
        +page.server.ts   -- SELECT * FROM reports with stats
        +page.svelte      -- Reports table (sort, filter, search, export)
      reports/[id]/
        +page.server.ts   -- Report detail + sessions + indications
        +page.svelte      -- Single report view
      admin/
        +page.server.ts   -- Sync log, trigger sync
        +page.svelte
    api/
      sync/+server.ts     -- POST: trigger sync (admin only)
      cron/+server.ts     -- GET: called by Railway cron (with secret)
drizzle/
  migrations/             -- SQL migration files
drizzle.config.ts
railway.toml              -- Railway deployment config
```

## Auth

Simple approach for 15 users:
- Keep the same cookie-based auth
- Options: Lucia auth with Postgres, or simple email/password table
- Admin role for sync triggers

## Migration Path

### Phase 1: Database + Sync (1-2 days)
- [ ] Create new repo `gni-v2`
- [ ] Set up Railway project (Postgres + Node service)
- [ ] Drizzle schema + run migrations
- [ ] Build ArcGIS API client (token management)
- [ ] Build sync script
- [ ] Run sync, verify numbers match current app exactly
- [ ] Set up Railway cron (hourly sync)

### Phase 2: SvelteKit App (2-3 days)
- [ ] Dashboard (stats cards, daily breakdown table)
- [ ] Reports page (table with sort/filter/search/export)
- [ ] Report detail page (sessions, indications, LISA modal)
- [ ] Admin page (sync trigger, sync log)
- [ ] Auth (login/logout, admin role)
- [ ] Deploy to Railway

### Phase 3: Validate & Switch (1 day)
- [ ] Run both apps side by side for a few days
- [ ] Compare all numbers between old and new
- [ ] Share new URL with co-workers
- [ ] Decommission VPS after confirmation period

### Phase 4: New Features (ongoing)
- [ ] Investigations view (ArcGIS layer 9)
- [ ] Field notes (layer 8)
- [ ] GIS map views (PostGIS + Leaflet/MapLibre)
- [ ] Automated PDF report generation
- [ ] Custom calculations and analytics

## What Gets Eliminated

| Current | Replaced by |
|---------|------------|
| Contabo VPS ($5/month) | Railway (~$5/month) |
| PocketBase (1.7M+ records, duplicate data) | Postgres (~20K records, no duplicates) |
| 55K-line sync script | ~200 lines |
| PM2 + systemd + nginx + lock files | Railway managed services |
| Webhook + signal handler sync trigger | SvelteKit API endpoint |
| 40 dead scripts on VPS | Nothing |
| Manual relationship rebuilding (30-60 min) | Foreign keys (instant) |
| Breadcrumb storage (1.6M rows) | ArcGIS aggregation queries (1.4s) |
| Schema mapping layer | Schema mirrors ArcGIS |

## ArcGIS Reference

```
Service URL: https://services-eu1.arcgis.com/t7DX8U1JVfVaU2tX/arcgis/rest/services/Gas_Networks_Ireland_LSRV_1_2/FeatureServer
Username: bdymet_pcubed_emea
Password: (in .env)

Layer  Name                    Records  Used in Phase
  0    Report Area             417      1 (reports table)
  1    Indication              363      1 (indications table)
  2    Field of View           N/A      Future
  3    Field of View Gap       14,927   1 (fov_gaps table)
  4    Pipes Intersecting LISA N/A      Future
  5    Pipes Intersecting Gap  N/A      Future
  6    Driving Session         3,410    1 (sessions table)
  7    Breadcrumb              660,959  1 (aggregation only, not stored)
  8    Field Notes             N/A      Future (field_notes table)
  9    Investigation           N/A      Future (investigations table)
  10   Gas Leak                N/A      Future (gas_leaks table)
  11   Other Source            N/A      Future (other_sources table)

IMPORTANT: Always use returnGeometry=false for data queries.
Geometry queries are 100-500x slower.
```
