# CLAUDE.md: Gratitude Connect

Offline-first PWA + admin console for the Gratitude Outreach church community event. Built by Geetek Global.

## Read first
`docs/ApplicationPrompt.md` → `docs/PRD.md` → `docs/DataModel.md` → `docs/Architecture.md` → `docs/DesignFlow.md` → `docs/DesignSystem.md` → `docs/BuildPlan.md`.
Log any judgement calls in `docs/DECISIONS.md` (date, decision, why).

## Commands
```bash
pnpm dev                 # Next.js dev
pnpm build && pnpm start
pnpm lint && pnpm typecheck
pnpm test                # vitest
pnpm e2e                 # playwright (includes offline scenarios)
supabase start           # local stack
supabase db reset        # migrations + seed (training edition)
supabase test db         # pgTAP RLS tests
supabase gen types typescript --local > src/lib/supabase/types.ts
```

## Rules
- **TypeScript strict**, no `any`. Zod schemas in `src/lib/schemas` are shared by client and server.
- **Fonts:** Sora 300/400/500 only. Never `font-semibold`/`font-bold` (removed from the theme; CI greps for them).
- **Colours:** only Tailwind tokens from `DesignSystem.md`. No raw hex values in components. `fresh`/`teal` are never text on white.
- **Data writes in the volunteer app go through the offline layer** (`src/lib/offline`): write to Dexie + outbox; never call Supabase directly from `/s` components for mutations.
- **IDs:** `uuidv7()` on the client for beneficiaries, visits, service_records, flags and inventory_movements.
- **Append-only:** never UPDATE `service_records`; void with `voided_at` instead.
- **Confidential data:** medical and counselling details only in `confidential_records`. Timeline `summary` strings must never contain confidential content (see DataModel §3).
- **RLS:** every new table gets RLS enabled plus policies plus pgTAP tests in the same PR. The service-role key is only used in `src/app/api/**` server code.
- **No personal data** in URLs, QR payloads, console logs, analytics or error messages. URLs use `visitId` UUIDs.
- **Accessibility:** touch targets ≥ 48 px, labels on all inputs, don't use colour alone, respect `prefers-reduced-motion`.
- **Every screen:** loading, empty, error, offline and read-only states.
- Keep `/s` bundles small: dynamic-import the scanner, charts and PDF.
- Times are displayed in `Africa/Lagos`; store as `timestamptz`.
- Phone numbers are normalised to E.164 (`+234…`).

## Domain glossary
Edition (yearly event) · Station (service point) · Beneficiary (person) · Visit (person × edition) · Gratitude Card (pre-printed QR + `GO26-0142`) · Need (requested service) · Service Record (what a station did) · Confidential Record (medical/counselling detail) · Follow-up (post-event pastoral task) · Session (volunteer's PIN-based login for one station).
