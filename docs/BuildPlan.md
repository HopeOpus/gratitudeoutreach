# Gratitude Connect — Build Plan

Build in this order. Each phase ends with **acceptance checks** that must pass before moving on. Requirement IDs refer to `PRD.md`.

---

## Phase 0: Foundation
- [ ] Next.js 15 + TS strict + Tailwind v4 + shadcn/ui init; ESLint, Prettier, Vitest, Playwright.
- [ ] Sora (300/400/500) via `next/font`; Tailwind tokens from `DesignSystem.md`; **remove semibold/bold weights** from the theme.
- [ ] Copy `public/brand/*` and generate PWA icons (192, 512, maskable) from `gratitude-icon.svg`.
- [ ] Supabase local project; env handling (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-only).
- [ ] Base UI kit: Button, Input, Chip, Segmented, Stepper, BottomSheet, Toast, AppHeader, SyncIndicator (static), Skeleton, EmptyState.

**Accept:** `/styleguide` page renders every token and component; Lighthouse PWA installable; no font weight above 500 anywhere (lint rule or grep check in CI).

## Phase 1: Database and security
- [ ] Migrations for all tables in `DataModel.md`, enums, indexes, `updated_at` triggers.
- [ ] RLS policies per the matrix; helper functions; `stations_public` view (no hashes).
- [ ] RPCs: `join_station`, `search_beneficiaries`, `find_duplicates`, `edition_snapshot`, `apply_patch`, `dashboard_stats`, `close_edition`, `break_glass`.
- [ ] Triggers: service after-insert (needs, inventory, follow-ups, flags), food duplicate guard, audit.
- [ ] pgTAP tests for every denied cell and own-station inserts.
- [ ] Seed with the training edition.

**Accept:** `supabase test db` green; an anonymous user without a session can read nothing; a Food session cannot read `confidential_records`; a Medical session cannot read counselling payloads.

## Phase 2: Admin setup (before the event)
- [ ] Admin auth and org membership; role guard middleware.
- [ ] Editions CRUD and clone (FR-1.1, 1.5); station config and PINs (FR-1.2, 1.4); role PINs.
- [ ] Inventory setup (FR-8.1).
- [ ] Card batch generation and **print PDF** (FR-2.1–2.3); station posters with join-QR.

**Accept:** create an edition → 1,500 cards → PDF prints at the correct size (85 × 55 mm, crop marks) and the QR scans from paper with a phone.

## Phase 3: Volunteer app core (offline-first)
- [ ] Dexie schema, outbox, sync worker, snapshot loader, realtime subscriber, sync pill (FR-13).
- [ ] Join flow (PIN / join token → name → role PIN → offline prep) (FR-12.1–12.2).
- [ ] Station home, scanner (BarcodeDetector + zxing fallback), search (Fuse in a worker), code keypad (FR-4).
- [ ] Profile and live timeline, needs chips, alerts (FR-5).

**Accept (Playwright):** with the network turned off after join, a volunteer can search, open a profile and see the timeline. Two browser contexts: a record saved in A appears in B's open profile in ≤ 2 s when online.

## Phase 4: Registration
- [ ] 3-step registration with card scan, duplicate sheet, minors/guardian, needs tiles, consent (FR-3.1–3.6).
- [ ] Card conflict and on-the-spot code fallback (FR-2.4–2.5).

**Accept:** registration under 60 s in a timed test; an offline registration syncs later with no duplicates; scanning an assigned card opens "already belongs to…".

## Phase 5: Station forms
- [ ] Prayer, Counselling 🔒, Medical 🔒, Food, Clothing forms (FR-6.1–6.5), refer and decline (FR-6.7), save loop with undo (FR-6.8–6.9).
- [ ] Pending list per station (FR-7.1–7.2).
- [ ] Inventory decrement and out-of-stock behaviour (FR-8.2, 8.4).

**Accept:** Food scan → saved in ≤ 4 taps; Salvation creates a follow-up; urgent counselling raises a flag for leads; a Medical dispense reduces stock; non-medical sessions see only "Medical check".

## Phase 6: Dashboard, follow-up, reports
- [ ] Live dashboard KPIs, station cards, alerts, sync health (FR-9.1, 9.2, 9.6), then charts and demographics (FR-9.3–9.5).
- [ ] Follow-up board and list, assign, call/WhatsApp, outcomes, consent filter (FR-10.1–10.4).
- [ ] Summary PDF, XLSX/CSV exports with audit (FR-11.1–11.2); close edition (FR-1.6).
- [ ] Volunteer management: move, revoke (FR-12.3).
- [ ] Beneficiary directory and merge duplicates (FR-9.7).

**Accept:** the dashboard numbers equal SQL ground-truth counts on seeded data; exports open in Excel with correct columns; closing the edition blocks new writes.

## Phase 7: Hardening and event readiness
- [ ] Training mode ribbon and training edition switch.
- [ ] Load test: 150 simulated devices, 5,000 people, 30,000 services (k6 or an Artillery script against the Supabase REST + Realtime).
- [ ] Accessibility pass (axe), large-font pass, sunlight check (contrast).
- [ ] Error monitoring; backup/export runbook; printable one-page quick guide per station (generated PDF).
- [ ] Device purge on revoke/expiry; rate-limit verification.

**Accept:** a dress rehearsal with real volunteers on their own phones, including 20 minutes in airplane mode, ends with **zero lost records** and the dashboard matching paper tallies.

---

## Definition of done (every feature)
1. Matches `DesignFlow.md` screens and `DesignSystem.md` tokens (Sora 300/400/500 only).
2. Works offline where the PRD says so.
3. RLS verified by a test.
4. Loading, empty, error and offline states implemented.
5. Mobile 360 px width and desktop 1440 px checked.
6. No personal data in URLs, logs or QR codes.
