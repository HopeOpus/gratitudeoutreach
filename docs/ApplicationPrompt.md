# Application Prompt: Build "Gratitude Connect"

> Paste this into Claude Code from the project root. Make sure the `docs/` folder and `public/brand/` are in the repo first.

---

You are a senior full-stack engineer and product designer. Build **Gratitude Connect**, an offline-first, mobile-first web app (PWA) plus an admin console for **Gratitude Outreach**, a church's yearly community outreach. On one day, the outreach serves hundreds to thousands of people with **prayer, counselling, free medical checks, food and clothing**.

## The problem you are solving
In past editions, every person got a paper code at arrival, and each station (prayer, counselling, medical, food, clothing) wrote their name down again. Afterwards, the data was scattered across papers and had to be collated by hand for weeks. We want: **register once, get a QR card, and every station scans the card, sees what earlier stations recorded in real time, records its own service in a few taps, and all data lands in one place with reports ready the moment the event ends.**

## Source of truth (read these fully before writing code)
1. `docs/PRD.md`: requirements (FR-x IDs), roles, scope (build **MVP** first)
2. `docs/DesignFlow.md`: site map, flows and screen layouts
3. `docs/DesignSystem.md`: colours from the logo, Sora typography, components, Tailwind tokens
4. `docs/Architecture.md`: stack, auth, offline sync engine, RLS approach, API routes
5. `docs/DataModel.md`: Postgres schema, JSON shapes, RLS matrix
6. `docs/BuildPlan.md`: phase order and acceptance checks
7. `CLAUDE.md`: coding rules for this repo

If documents conflict, priority is: **PRD > DataModel > Architecture > DesignFlow > DesignSystem**. If something is ambiguous, choose the option that is simplest for a volunteer on a cheap Android phone outdoors, and note the decision in `docs/DECISIONS.md`.

## Non-negotiables
- **Stack:** Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui (restyled), Supabase (Postgres, Auth with anonymous sign-in for volunteers, Realtime, RLS), Dexie (IndexedDB), Serwist (PWA), React Hook Form + Zod, TanStack Query, `exceljs`, `@react-pdf/renderer`, `lucide-react`, `uuidv7`.
- **Brand:** colours only from `DesignSystem.md` (forest #07210D, leaf #188B12, fresh #53D34C, teal #09BFC2, ink #272727, plus the defined tints and functional colours). Respect the contrast rules: never use `fresh` or `teal` as text on white; use `leaf-600/700` for small green text.
- **Font:** **Sora only, weights 300 (Light), 400 (Regular), 500 (Medium).** No semibold or bold anywhere. Emphasis comes from Medium, size and colour.
- **Logos:** use files in `public/brand/` (`gratitude-logo.svg` on light, `gratitude-logo-white.svg` on dark, `gratitude-mark-transparent.svg` in the dark mobile header, `gratitude-icon.svg` for PWA icons).
- **Offline-first:** volunteers must be able to search, view profiles, register and record services with no network; data syncs automatically later with no loss and no duplicates (client UUID v7, idempotent upserts, outbox).
- **Real-time:** a service saved at one station appears on any other device viewing that person within ~2 seconds when online.
- **Privacy (Nigeria Data Protection Act 2023):** consent at registration; counselling and medical details live in `confidential_records` and are readable **only** by sessions at that station type (not even coordinators, except via audited break-glass). No personal data in QR codes, URLs or logs. RLS on every table, default deny, covered by pgTAP tests.
- **Volunteer UX:** no email or password for volunteers (station PIN or join-QR, then name). Big touch targets (≥ 48 px; primary actions 56 px). Food/Clothing scan → saved in ≤ 4 taps. Light theme, high contrast for sunlight.
- **Every screen** handles loading, empty, error, offline, permission-denied and read-only (edition closed) states.

## What to build (MVP)
1. **Admin console** (`/admin`): editions (create/clone/live/close), stations and PINs, inventory, **card batch generation plus print-ready PDF** (85 × 55 mm cards with logo, QR, code `GO26-0142`), station posters with join-QR, live dashboard (KPIs, per-station cards, alerts, device sync health), beneficiary directory with duplicate merge, follow-up pipeline (board + list, call/WhatsApp links, outcomes), reports (branded summary PDF, XLSX/CSV exports, audit-logged), volunteer session management, audit log.
2. **Volunteer PWA** (`/s`): join → station home (Scan · Search · Type code · Pending · Recent) → profile with needs and live timeline → station-specific service form → save with toast plus undo → back to scan.
3. **Registration** (3 steps): scan blank card → details (with live duplicate check and returning-beneficiary detection, guardian for minors) → needs tiles → consent script → success screen with a big code.
4. **Station forms:** Prayer (focus, decision → auto follow-up), Counselling 🔒 (category, confidential notes, risk flag, follow-up, refer), Medical 🔒 (vitals with abnormal highlighting, complaint chips, tests, impression, dispense from stock, referral), Food (pack tiles, qty, duplicate guard with lead override), Clothing (category/size/qty basket). All forms: notes, refer to station, decline need.
5. **Server logic** as Postgres triggers and RPCs: need status updates, inventory decrement, follow-up creation, flags, food duplicate guard, audit, dashboard stats, edition snapshot, volunteer `join_station` with bcrypt PINs and rate limiting.
6. **Training mode:** a seeded training edition with 300 fake beneficiaries and a persistent "TRAINING" ribbon.

## How to work
- Follow `docs/BuildPlan.md` phase by phase. At the start, write a short plan for the phase; at the end, run the acceptance checks (tests, type-check, lint, build) and summarise what passed.
- Start with Phase 0 + 1 (foundation, schema, RLS, tests) before any UI that touches data.
- Generate Supabase types (`supabase gen types typescript`) and share Zod schemas between client and server.
- Keep volunteer routes light (< 200 KB JS gzipped): lazy-load the scanner, PDF and charts.
- Write Playwright e2e tests for: join, offline registration then sync, scan → serve → realtime appears on a second context, confidential visibility per role, export.
- Commit after each phase with clear messages. Do not commit secrets.
- When done with the MVP, produce `README.md` with setup, env vars, seeding, the training PINs, deployment (Vercel + Supabase), and an **Event-day runbook** (pre-event checklist, device prep, what to do if offline, how to close the edition).

Begin by reading all docs, then reply with: (1) your understanding in 5 bullets, (2) any blocking questions, and (3) the Phase 0–1 plan. Then start building.
