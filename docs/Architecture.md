# Gratitude Connect — Technical Architecture

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript (strict)** | Geetek's primary stack; one codebase for the volunteer PWA and the admin console |
| Styling | **Tailwind CSS v4 + shadcn/ui** (restyled to `DesignSystem.md`) | Fast, consistent, accessible primitives (Radix) |
| Font | `next/font/google` → **Sora 300/400/500** | Self-hosted at build, so it works offline |
| Backend / DB | **Supabase**: Postgres, Auth (email + **anonymous**), **Realtime**, **Row Level Security**, Storage | Realtime timeline plus RLS for confidential data, with no custom server to run |
| Local DB (offline) | **Dexie.js** (IndexedDB) | Local cache plus outbox queue |
| PWA / Service worker | **Serwist** (`@serwist/next`) | Precache the app shell; runtime caching; installable |
| Data fetching | **TanStack Query** (online reads for admin) + Dexie `liveQuery` (volunteer app) | |
| Forms / validation | **React Hook Form + Zod** (schemas shared client and server) | |
| QR scan | Native **`BarcodeDetector`** where available, fallback **`@zxing/browser`** | Fast on Android Chrome; works on iOS |
| QR generate | `qrcode` | |
| PDF (cards, posters, reports) | `@react-pdf/renderer` (server route) | |
| Excel export | **`exceljs`** (CSV via `papaparse`) | |
| Fuzzy search (offline) | `fuse.js` locally; `pg_trgm` server-side | Tolerates name misspellings |
| Charts | `recharts` | |
| Icons | `lucide-react` | |
| IDs | **UUID v7** generated on the client (`uuidv7`) | Offline-safe, time-sortable, idempotent sync |
| Hosting | **Vercel** (app) + **Supabase** (Pro plan during event month recommended) | |
| Monitoring | Sentry (optional) + Supabase logs | |
| Testing | Vitest (unit), Playwright (e2e incl. offline mode), Supabase local (`supabase start`) for RLS tests with pgTAP | |

---

## 2. High-level diagram

```
 Volunteer phones (PWA)                     Admin console (web)
 ┌──────────────────────────┐               ┌───────────────────┐
 │ UI (React)               │               │ Dashboard/Reports │
 │  ↕ Dexie liveQuery       │               │ TanStack Query    │
 │ IndexedDB: cache+outbox  │               └─────────┬─────────┘
 │  ↕ Sync engine           │                         │
 │ Service worker (Serwist) │                         │
 └──────────┬───────────────┘                         │
            │ HTTPS (supabase-js) + Realtime WS        │
 ┌──────────▼─────────────────────────────────────────▼─────────┐
 │ Supabase: Auth · Postgres (RLS) · Realtime · Storage · RPCs   │
 └──────────▲───────────────────────────────────────────────────┘
            │ server-only (service role)
 ┌──────────┴──────────────┐
 │ Next.js route handlers  │  PDF cards/posters/reports, XLSX exports,
 │ /api/*  (Vercel)        │  admin-only ops, scheduled retention job
 └─────────────────────────┘
```

---

## 3. Authentication and authorisation

### Admins
Supabase email/password or magic link. Membership and role are stored in `org_members (user_id, role)`, with roles `super_admin | coordinator | followup | viewer`.

### Volunteers (no email)
1. The client calls `supabase.auth.signInAnonymously()`.
2. The client calls RPC **`join_station(p_pin text, p_name text, p_phone text, p_role_pin text default null)`**, which is `SECURITY DEFINER` and:
   - finds the station in a **Live** edition whose `join_pin_hash = crypt(p_pin, join_pin_hash)`;
   - rate-limits (5 failures per 5 min per `auth.uid()` and per IP header) and locks out;
   - if `stations.kind in ('medical','counselling')`, verifies `role_pin_hash`;
   - inserts `volunteer_sessions (user_id = auth.uid(), edition_id, station_id, role, display_name, phone, expires_at = end of event day + 6h)`;
   - returns the session and station config.
3. Join links (`/join/[token]`) carry a signed, expiring station token instead of the PIN.

### RLS helper functions (SQL, `STABLE SECURITY DEFINER`)
```sql
is_org_role(roles text[])          -- admin roles
active_session()                   -- returns volunteer_sessions row for auth.uid() not expired/revoked
can_access_edition(edition uuid)   -- admin OR active session for that edition
has_confidential(kind text)        -- active session's station kind = kind (medical|counselling), or a valid break-glass grant
```

**Confidential policy:** `confidential_records` rows of kind `medical` are readable only by sessions at a medical station (and Medical Station Leads). Kind `counselling` is readable only by counselling sessions and leads. **Super Admins and Coordinators do not read confidential content by default.** They can only "break glass" with a recorded reason, which writes an audit row and expires after 1 hour. Aggregates (counts, referral flags, risk-flag counts) come from non-confidential columns.

Every table has RLS **enabled with default deny**. Policies live in `supabase/migrations`. The service-role key is used **only** in server route handlers and never shipped to the client.

---

## 4. Offline-first sync engine

### Local schema (Dexie)
```
beneficiaries   (id, full_name, phone_last4, phone, gender, age_range, community, ...updated_at)
visits          (id, edition_id, beneficiary_id, card_code, needs[], status, ...updated_at)
service_records (id, visit_id, station_id, summary, data, created_at, ...)
need_status     (visit_id+station_id, status, at)
flags           (id, visit_id, kind, scope, text)
inventory       (id, station_id, name, remaining)
outbox          (seq++, op_id uuid, table, type:'insert'|'patch', payload, attempts, last_error, created_at)
meta            (cursor per table, edition config, session)
```
Confidential payloads are stored locally **only on devices whose session has that permission**, and are cleared on sign-out or session expiry.

### Write path
1. The UI writes to Dexie **and** appends to `outbox` in one Dexie transaction, so the UI updates instantly.
2. The sync worker (runs on `online`, every 5 s while online, on visibility change, and on manual "Sync now"):
   - takes up to 50 outbox ops in order;
   - pushes inserts with `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` (idempotent, so retries are safe);
   - pushes patches via RPC `apply_patch(table, id, fields jsonb, client_updated_at)` (per-field last-write-wins plus an audit row);
   - on success, deletes the op; on a 4xx validation error, marks it failed, surfaces it in the sync pill and keeps it for review; on network error, retries with exponential backoff up to 60 s.
3. Server triggers do the derived work: inventory decrement, need-status update, follow-up creation, alerts.

### Read path
- **Initial snapshot** at join: an RPC `edition_snapshot(edition_id)` returns all visits, beneficiaries (minimal fields), non-confidential service records, inventory and flags. It is gzip-friendly JSON, paged by 1,000.
- **Live updates:** a Supabase Realtime `postgres_changes` channel filtered by `edition_id=eq.<id>` on `visits`, `service_records`, `need_status`, `inventory_items` and `flags`. Realtime respects RLS.
- **Delta catch-up** after reconnecting: `select * where edition_id = $1 and updated_at > cursor` per table.

### Conflicts
- `service_records`, `followup_events` and `inventory_movements` are **append-only**, so they never conflict.
- Beneficiary/visit edits use per-field LWW by `client_updated_at`; the losing values are preserved in `audit_log`.
- Card assignment uses a **unique constraint** on `(edition_id, card_code)`. If two offline devices assign the same pre-printed card (rare), the second sync fails and the coordinator sees a "card conflict" item in data quality to resolve.
- **Code blocks** for on-the-spot codes: on join (online), a Registration device reserves `code_blocks (device_id, start, end)`, e.g. 200 numbers, giving codes like `GO26-R3-017`.

### Service worker
- Precache: app shell, routes `/s/*`, fonts, icons and logos.
- Runtime: `NetworkFirst` for `/api/*` GET with a 3 s timeout; Supabase REST is not cached by the SW (Dexie handles data).
- Background Sync API used where supported to flush the outbox; the in-app sync worker covers iOS.

---

## 5. Server-side logic (Postgres functions and triggers)

| Trigger / RPC | Does |
|---|---|
| `trg_service_after_insert` | Marks `need_status` = served for (visit, station); inserts inventory movements from `data.items` and decrements stock; creates follow-ups (prayer decision, wants follow-up, counselling follow-up/urgent, medical referral); writes alerts |
| `trg_food_duplicate_guard` | Rejects a second Food record per visit unless `data.override_by` holds a valid lead override |
| `trg_audit_*` | Writes the audit log for insert/update/delete on core tables |
| `trg_touch_updated_at` | Maintains `updated_at` for delta sync |
| `join_station(...)` | Volunteer session creation (see §3) |
| `search_beneficiaries(q, edition)` | Trigram plus phone suffix search, RLS-safe |
| `find_duplicates(name, phone)` | Candidate matches across editions |
| `edition_snapshot(edition, page)` | Initial offline cache |
| `dashboard_stats(edition)` | KPIs and per-station aggregates (materialised view refreshed every 15 s, or computed on demand) |
| `close_edition(edition)` | Locks the edition and queues the report job |
| `apply_patch(...)` | Field-level LWW updates plus audit |
| `break_glass(kind, visit, reason)` | Temporary confidential read grant plus audit |

---

## 6. API routes (Next.js, server-only)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/cards/batch` | POST | Generate N card codes | coordinator+ |
| `/api/cards/pdf?batch=` | GET | Print-ready card sheets (A4 8/10-up, or 58 mm labels) | coordinator+ |
| `/api/posters/pdf?edition=` | GET | Station posters with join-QR | coordinator+ |
| `/api/reports/summary.pdf?edition=` | GET | Branded summary report | viewer+ |
| `/api/exports/[dataset].xlsx?edition=` | GET | Exports (confidential columns excluded unless the role allows); audit-logged | coordinator+ |
| `/api/join-token` | POST | Signed station join link | coordinator+ |
| `/api/cron/retention` | GET (Vercel cron) | Redacts expired confidential payloads | cron secret |

---

## 7. Security and privacy (NDPA 2023)

- **Lawful basis:** consent captured at registration (`visits.consent_data_at`, `consent_followup_at`, and `consent_text_version`).
- **Minimisation:** the phone number is optional; there is no address beyond community/area; photos are off by default.
- **Access control:** RLS default deny; confidential separation; role PINs; session expiry; device revoke.
- **Encryption:** TLS in transit; Supabase at-rest encryption. Confidential `payload` also encrypted with `pgsodium`/Vault column encryption if on a supported plan (otherwise rely on RLS plus at-rest encryption).
- **No personal data in QR codes, URLs, logs or analytics.** Use `visitId` UUIDs in URLs only.
- **Exports** are audit-logged and need coordinator+; confidential exports need break-glass.
- **Device loss:** coordinators revoke the session, and the device purges its local data on its next online check. Local data auto-purges 48 h after the session expires.
- **PIN storage:** bcrypt (`crypt()` + `gen_salt('bf')`); never stored in plain text.
- **Rate limiting:** on `join_station` and search RPCs.

---

## 8. Environments and project structure

```
apps: single Next.js app
src/
  app/
    (public)/page.tsx, join/...
    s/            ← volunteer PWA routes (client-heavy, offline)
    admin/        ← admin console (server components + TanStack Query)
    api/          ← route handlers
  components/ui/       ← shadcn restyled
  components/station/  ← ScanButton, PersonCard, Timeline, NeedChip, forms/*
  components/admin/    ← KPI tiles, StationCard, charts, tables
  lib/
    supabase/ (client.ts, server.ts, types.ts generated)
    offline/  (db.ts Dexie, sync.ts, outbox.ts, snapshot.ts, realtime.ts)
    schemas/  (zod: beneficiary, visit, service per station)
    scan/     (barcode-detector.ts, zxing-fallback.ts)
    pdf/      (cards.tsx, poster.tsx, report.tsx)
    i18n/     (en.json; pcm.json, ha.json later)
  sw.ts       ← Serwist
supabase/
  migrations/ ← DDL + RLS + functions (see DataModel.md)
  seed.sql    ← demo edition + 300 fake beneficiaries for training mode
  tests/      ← pgTAP RLS tests
public/brand/ ← logos (provided)
```

Environments: `local` (Supabase CLI), `staging` (training runs), `production`. **Training mode** points at a separate `training` edition flagged `is_training = true`, which is excluded from all reports.

---

## 9. Performance budgets

- JS for `/s` routes under 200 KB gzipped (lazy-load the scanner and PDF code).
- Snapshot of 5,000 people in under 1.5 MB gzipped.
- Local search results in under 50 ms (Fuse index built once in a Web Worker).
- Profile open from cache in under 150 ms.
