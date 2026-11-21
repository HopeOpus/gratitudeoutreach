# Gratitude Connect

Offline-first PWA and admin console for the **Gratitude Outreach** community day.

*Register once. Every station sees what happened before. No paper collation afterwards.*

- **Volunteer app** `/s`: join with a station PIN, scan a Gratitude Card, see the live timeline, record a service in a few taps. Works with no network and syncs later.
- **Admin console** `/admin`: editions, stations and PINs, card printing, inventory, live dashboard, follow-ups, reports and exports, audit log.

Specs live in [`docs/`](docs). Judgement calls are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind v4 · Supabase (Postgres, RLS, Auth incl. anonymous sign-in, Realtime) · Dexie (IndexedDB) · Serwist (PWA) · TanStack Query · React Hook Form + Zod · `@react-pdf/renderer` · `exceljs` · `uuidv7` · Vitest · Playwright · pgTAP.

## Local setup

Needs Node 22+, pnpm, and Docker (for the local Supabase stack).

```bash
pnpm install
pnpm exec supabase start          # local Postgres/Auth/Realtime on :54321
pnpm exec supabase db reset       # migrations + seed (training edition)
cp .env.example .env.local        # then paste the keys printed by `supabase start`
pnpm dev                          # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key (RLS protects all data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used only in `src/app/api/**` after a role check (PIN secrets, join tokens, admin invites) |
| `JOIN_TOKEN_SECRET` | server only | ≥ 32 random chars. Encrypts printable PIN copies. **Changing it makes stored PINs unreadable**; rotate the PINs afterwards. |
| `CRON_SECRET` | server only | Protects `/api/cron/retention` (Vercel cron sends it as a Bearer token) |
| `NEXT_PUBLIC_APP_URL` | optional | Public URL used in join links/posters (defaults to the request host) |

## Commands

```bash
pnpm dev | pnpm build && pnpm start
pnpm lint && pnpm typecheck && pnpm check:fonts   # check:fonts fails on any weight > 500
pnpm test                 # Vitest unit tests
pnpm e2e                  # Playwright (needs `supabase start` + `pnpm build`)
pnpm db:reset             # supabase db reset (migrations + seed)
pnpm db:test              # pgTAP RLS + workflow tests
pnpm db:types             # regenerate src/lib/supabase/types.ts
pnpm icons                # regenerate PWA icons + PDF logos from public/brand
```

`/styleguide` shows every token and component.

---

## Training mode and seed data

`supabase db reset` creates:

- **Training 2026** (`TR26`, live, `is_training = true`): 300 fake people, 400 cards (`TR26-0001`…`0400`), 60 inventory items, and needs/services/follow-ups so the dashboard looks alive. Every screen shows a **TRAINING** ribbon, and training editions are excluded from year-on-year reports.
- **Gratitude Outreach 2026** (`GO26`, draft): default stations with random PINs. Rotate them in *Editions → Stations* to reveal and print.

### Training PINs

| Station | Station PIN | Role PIN (confidential) | Lead PIN |
|---|---|---|---|
| Registration | `111111` | — | `999999` |
| Prayer | `222222` | — | `999999` |
| Counselling | `333333` | `303030` | `999999` |
| Medical | `444444` | `404040` | `999999` |
| Food | `555555` | — | `999999` |
| Clothing | `666666` | — | `999999` |

A Lead PIN entered at join ("I'm the Station Lead") makes that person a Station Lead. It also approves a second food collection.

### Training admin logins (password `Gratitude2026!`)

| Email | Role |
|---|---|
| `admin@gratitude.test` | Super Admin |
| `coordinator@gratitude.test` | Coordinator |
| `followup@gratitude.test` | Follow-up team |
| `viewer@gratitude.test` | Viewer |

**Never create these accounts in production.** The seed only runs on `supabase db reset`.

---

## Deployment (Vercel + Supabase)

1. **Supabase**: create a project (Pro plan recommended for the event month). In *Auth → Providers*, enable **Email** and **Anonymous sign-ins**. Raise the anonymous sign-in rate limit to about 300/hour (all volunteers may join from one venue IP).
2. Apply the schema: `pnpm exec supabase link --project-ref <ref>` then `pnpm exec supabase db push`. **Do not run `seed.sql` in production.**
3. Create the organisation in the SQL editor, then the first Super Admin with the script (it prints a generated password):
   ```sql
   insert into organizations (name, church_name, consent_text) values ('Gratitude Outreach', 'Gratitude Church', '<consent script>');
   ```
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
     node scripts/create-admin.mjs you@church.org super_admin "Your Name"
   ```
4. **Vercel**: import the repo and set the env vars above (service role, `JOIN_TOKEN_SECRET`, `CRON_SECRET` as *server* variables). `vercel.json` schedules the nightly retention job.
5. In Supabase *Auth → URL configuration*, set the site URL to your Vercel domain (for magic links and invites).
6. Run `pnpm db:test` against a staging project before the event.

---

## Event-day runbook

### Two weeks before
- [ ] Create the edition (*Editions → New edition*; clone last year to copy stations and inventory).
- [ ] Check stations, then rotate PINs. Give **role PINs** only to the Medical and Counselling leads.
- [ ] Enter inventory with opening quantities and low-stock thresholds.
- [ ] Generate cards: expected turnout + 30%. Print the PDF **at 100% scale**, test-scan one printed card with a phone, then print and cut the rest.
- [ ] Print station posters (*Stations → Station posters*). They show the join QR and PIN.
- [ ] Print one quick guide per station (*Stations → Quick guides*) and tape it to each table.
- [ ] Review the consent script (*Settings*).
- [ ] Run a training session on the **Training 2026** edition with real volunteers on their own phones. Include 10–20 minutes in airplane mode.

### Device prep (morning of the event, on venue Wi-Fi/MiFi)
- [ ] Each volunteer scans their station poster (or types the PIN), enters their name, and waits for **"Getting ready for offline"** to finish.
- [ ] Ask Android users to **Add to Home screen** (Chrome menu). The app then opens without a network.
- [ ] Check the header shows **● Synced**. Charge phones and keep power banks at every station.
- [ ] Set the edition **LIVE** (*Editions → Set live*). Volunteers can only join a live edition.

### During the event
- Watch the **Live** dashboard: pending queues, low stock, urgent counselling flags, and **devices with unsynced records**.
- Move volunteers between stations, or end a lost phone's session, under *Editions → Volunteers*.

### If the network drops
- **Keep serving.** Scanning, search, registration and every station form work offline. The header pill shows *Offline · N pending*.
- Records sync automatically when any network returns. To force it, the volunteer opens **Me → Sync now**.
- If a pill shows **Sync error**, open **Me** to see what failed. Most errors are a card used on two phones (the person is kept; give them a new card) or a closed edition. Show it to the coordinator before discarding anything.
- Volunteers should **not** tap "Leave station" while records are pending. The app warns them.
- If cards run out, Registration taps **No cards left? Create a code** and writes the code (e.g. `GO26-R3-017`) on a wristband or paper.

### Closing the edition
1. Ask all volunteers to connect and tap **Me → Sync now**.
2. On the dashboard, check **Volunteers and device sync** shows 0 unsynced.
3. *Close edition*. If devices are still unsynced, you'll be asked to wait or close anyway. Closing makes the edition read-only (a Super Admin can reopen it).
4. *Reports*: download the **Summary report (PDF)** and the Excel exports. Every export is audit-logged.
5. The follow-up team works the *Follow-ups* board. Contact details show only for people who consented.

### After the event
- Volunteer sessions expire 6 hours after the event day. Devices purge local data 48 hours after expiry, or immediately when a coordinator ends the session.
- Confidential notes are automatically redacted after the retention period (default 24 months after close).

### Backups and data export
- **Before the event:** on the Supabase Pro plan, daily backups are automatic. Also take a manual snapshot (*Database → Backups*) the evening before.
- **During the event:** each phone keeps its records until they sync, so a server outage loses nothing.
- **Straight after closing:** download every Excel export from *Reports* and the summary PDF, and store them in the church's shared drive (access limited to the leadership team). Exports never contain medical or counselling notes.
- **Full database copy** (Super Admin, technical): `pnpm exec supabase db dump --linked -f backup-$(date +%F).sql` and `pnpm exec supabase db dump --linked --data-only -f data-$(date +%F).sql`. Treat these files as confidential: they contain everything, including confidential notes.
- **Restore:** a Supabase point-in-time restore (*Database → Backups*), or `psql <new db url> -f backup.sql -f data.sql` into a fresh project, then `supabase db push` to confirm migrations match.

---

## Hardening checks (Phase 7)

| Check | How | Latest local result |
|---|---|---|
| Load: 150 devices, 5,000 people, 30,000 services | `node scripts/load-test.mjs` (local or **staging** only) | 0 lost, 0 duplicated, dashboard = ground truth; p95 589 ms at ~390 writes/s |
| Realtime at event pace | `node scripts/load-test.mjs --devices 40 --people 300 --services 240 --listeners 20 --rate 8` | 4,800 / 4,800 events delivered, p95 14 ms |
| Accessibility (WCAG 2.2 AA, axe) | `pnpm e2e tests/e2e/a11y.spec.ts` | 0 serious/critical issues on volunteer and admin screens |
| JS budget `/s` | measure initial scripts from `/s` HTML | 189.5 KB gzip (budget 200 KB) |
| Large system font | text sizes use `rem`; a 200% font test runs in the a11y suite | No horizontal overflow; station loop usable |
| Device purge + rate limit | `pnpm e2e tests/e2e/hardening.spec.ts`, `supabase/tests/04_rate_limit.sql` | Revoked phone wiped; 5 failures per device / 30 per venue IP |

Under artificial bursts (hundreds of writes per second), Supabase Realtime throttles fan-out. Each phone also pulls a delta every 30 seconds, so every device catches up regardless.

**Error monitoring:** client errors have phone numbers, emails, card codes and ids stripped (app error messages never contain names) and are sent to `/api/client-errors`, which writes them to the Vercel logs (`"type":"client_error"`). To add Sentry later, call it from `src/lib/monitoring.ts`.

---

## Privacy and security (NDPA 2023)

- Consent is captured at registration (data processing required, follow-up contact optional), with the consent text version.
- RLS is enabled with **default deny on every table**. It is tested by pgTAP (`supabase/tests`, 97 assertions), including every denied cell in the role matrix.
- Medical and counselling details live only in `confidential_records`. They are readable **only** by sessions at that station type. Admins need audited, 1-hour **break-glass** access.
- No personal data in QR codes (`GC:GO26-0142` only), URLs (visit UUIDs only) or logs. Supabase responses and admin pages are never cached by the service worker.
- PINs are bcrypt-hashed. Joins are rate-limited: 5 failures per 5 minutes per phone, and 30 per venue IP (phones on one Wi-Fi share an IP, so a few typos never lock out the whole venue).

## Tests

| Suite | Covers |
|---|---|
| `supabase/tests/01_rls.sql` | Join + lockout, no-session/anon denial, food/medical/counselling separation, admin roles, break-glass audit |
| `supabase/tests/02_workflows.sql` | Registration, card assignment, salvation → follow-up, urgent counselling flag, medical dispense → stock, undo/void, LWW patches, closed edition |
| `supabase/tests/03_upsert_sync.sql` | Offline outbox upserts for every client-written table; idempotent retries |
| `supabase/tests/04_rate_limit.sql` | Per-device and per-venue-IP PIN lockout |
| `tests/unit` | Phone normalisation, card codes, summary privacy, schemas, vitals, sync retry rules, error scrubbing |
| `tests/e2e` | Join, offline registration → sync with no duplicates, offline lookup + realtime on a second device, confidential visibility per role, exports, PDFs, accessibility (axe), device purge on revoke, PIN lockout |
