// Event-scale load test (BuildPlan Phase 7): simulated volunteer devices writing
// through the same API calls the outbox uses (idempotent upserts), plus realtime
// listeners. Verifies zero lost / duplicated records and dashboard == ground truth.
//
//   node scripts/load-test.mjs [--devices 150] [--people 5000] [--services 30000] [--listeners 20]
//
// Needs an admin login (coordinator+) to create a throw-away training edition:
//   LOAD_ADMIN_EMAIL / LOAD_ADMIN_PASSWORD (default: seeded coordinator@gratitude.test).
// Run against local or STAGING only — never production.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = { ...process.env };
if (existsSync(".env.local")) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#") && !env[l.slice(0, i)]) env[l.slice(0, i)] = l.slice(i + 1); }
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : def; };
const RATE = arg("rate", 0); // services per second cap (0 = as fast as possible)
const DEVICES = arg("devices", 150), PEOPLE = arg("people", 5000), SERVICES = arg("services", 30000), LISTENERS = arg("listeners", 20);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mk = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lat = []; let errors = 0, retriedDupes = 0;
const errSamples = new Map();

async function timed(fn) {
  for (let attempt = 0; ; attempt++) {
    const t = performance.now();
    const { error } = await fn();
    lat.push(performance.now() - t);
    if (!error) return;
    const retryable = !error.code || error.code.startsWith("PGRST3") || error.code.startsWith("08") || error.code === "57014" || error.code === "40001";
    if (retryable && attempt < 6) { await sleep(200 * 2 ** attempt); continue; }   // same as outbox backoff
    errors++; errSamples.set(error.code + " " + error.message, (errSamples.get(error.code + " " + error.message) ?? 0) + 1);
    return;
  }
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

// ---------------------------------------------------------------------------
console.log(`Load test: ${DEVICES} devices, ${PEOPLE} people, ${SERVICES} services, ${LISTENERS} realtime listeners`);
const admin = mk();
const { error: loginErr } = await admin.auth.signInWithPassword({ email: env.LOAD_ADMIN_EMAIL ?? "coordinator@gratitude.test", password: env.LOAD_ADMIN_PASSWORD ?? "Gratitude2026!" });
if (loginErr) throw new Error(`Admin login failed: ${loginErr.message}`);
const { data: member } = await admin.from("org_members").select("org_id").limit(1).single();
const prefix = `L${String(Date.now()).slice(-4)}`;
const { data: editionId, error: edErr } = await admin.rpc("create_edition", { p_org: member.org_id, p_name: `Load test ${prefix}`, p_code_prefix: prefix, p_starts_on: new Date().toISOString().slice(0, 10), p_ends_on: new Date().toISOString().slice(0, 10), p_is_training: true });
if (edErr) throw edErr;
const { data: stations } = await admin.from("stations_public").select("id, kind").eq("edition_id", editionId);
const pins = {}; let n = 0;
for (const s of stations) {
  const pin = String(700000 + Math.floor(Math.random() * 99000) + n++ * 7).slice(0, 6);
  const role = ["medical", "counselling", "pharmacy", "medical_assistant", "optician", "laboratory"].includes(s.kind) ? "818181" : undefined;
  const { error } = await admin.rpc("set_station_pins", { p_station: s.id, p_join_pin: pin, p_role_pin: role });
  if (error) throw error;
  pins[s.kind] = { pin, role, id: s.id };
}
const { data: items } = await admin.from("inventory_items").insert([
  { edition_id: editionId, station_id: pins.food.id, name: "Family pack", opening_qty: 100000 },
  { edition_id: editionId, station_id: pins.clothing.id, name: "Shirt", opening_qty: 100000 },
  { edition_id: editionId, station_id: pins.medical.id, name: "Paracetamol", opening_qty: 100000 },
]).select("id, station_id");
const itemFor = Object.fromEntries(items.map((i) => [i.station_id, i.id]));
await admin.from("editions").update({ status: "live" }).eq("id", editionId);

// Devices join (anonymous auth + PIN)
const plan = [];
const regDevices = Math.max(1, Math.round(DEVICES * 0.15));
for (let i = 0; i < DEVICES; i++) plan.push(i < regDevices ? "registration" : pick(["food", "prayer", "clothing", "medical", "food"]));
const t0 = performance.now();
const devices = [];
await pool(plan, 25, async (kind) => {
  const sb = mk();
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(`anon sign-in: ${error.message}`);
  const p = pins[kind];
  const { data } = await sb.rpc("join_station", { p_pin: p.pin, p_name: `Load ${kind}`, p_role_pin: p.role ?? null, p_confidential_ack: true });
  if (!data?.session) throw new Error(`join failed for ${kind}: ${JSON.stringify(data)}`);
  devices.push({ sb, kind, session: data.session, station: data.station.id, org: data.edition.org_id });
});
console.log(`✓ ${devices.length} devices joined in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

// Realtime listeners (like open profiles / dashboards)
let rtEvents = 0;
const listeners = devices.filter((d) => d.kind !== "registration").slice(0, LISTENERS);
await Promise.all(listeners.map((d) => new Promise((resolve) => {
  d.sb.channel(`lt:${randomUUID()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "service_records", filter: `edition_id=eq.${editionId}` }, () => rtEvents++)
    .subscribe((s, err) => { if (s !== "SUBSCRIBED") console.log("listener:", s, err?.message ?? ""); if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(); });
})));
console.log(`✓ ${listeners.length} realtime listeners subscribed`);

// Phase A: registration
const reg = devices.filter((d) => d.kind === "registration");
const visits = [];
const regJobs = Array.from({ length: PEOPLE }, (_, i) => i);
const tA = performance.now();
await pool(regJobs, reg.length, async (i) => {
  const d = reg[i % reg.length];
  const bid = randomUUID(), vid = randomUUID(), at = new Date().toISOString();
  const ben = { id: bid, org_id: d.org, full_name: `Load Person ${i}`, gender: pick(["female", "male"]), age_range: pick(["18-35", "36-59", "60+"]), community: pick(["Kpegi", "Karu", "Nyanya"]) };
  const visit = { id: vid, edition_id: editionId, beneficiary_id: bid, card_code: `${prefix}-${String(i + 1).padStart(5, "0")}`, registered_by_session: d.session.id, registered_by_name: "Load", registered_at: at, consent_data_at: at, consent_version: 1 };
  await timed(() => d.sb.from("beneficiaries").upsert(ben, { onConflict: "id", ignoreDuplicates: true }));
  await timed(() => d.sb.from("visits").upsert(visit, { onConflict: "id", ignoreDuplicates: true }));
  if (Math.random() < 0.1) { retriedDupes++; await timed(() => d.sb.from("visits").upsert(visit, { onConflict: "id", ignoreDuplicates: true })); }
  await timed(() => d.sb.from("visit_needs").upsert(["food", "prayer"].map((k) => ({ visit_id: vid, station_id: pins[k].id, edition_id: editionId })), { onConflict: "visit_id,station_id", ignoreDuplicates: true }));
  visits.push(vid);
});
const regSecs = (performance.now() - tA) / 1000;
console.log(`✓ Phase A: ${PEOPLE} registrations in ${regSecs.toFixed(1)} s (${(PEOPLE / regSecs).toFixed(0)}/s)`);

// Phase B: services (optionally paced with --rate) (food at most once per person — the duplicate guard is tested separately)
const svc = devices.filter((d) => d.kind !== "registration");
const byKind = (k) => svc.filter((d) => d.kind === k);
const foodQueue = [...visits].sort(() => Math.random() - 0.5);
const jobs = Array.from({ length: SERVICES }, (_, i) => i);
const expected = new Set();
const tB = performance.now();
await pool(jobs, svc.length, async (i) => {
  if (RATE) { const due = tB + (i / RATE) * 1000; const wait = due - performance.now(); if (wait > 0) await sleep(wait); }
  let d = svc[i % svc.length];
  let visitId;
  if (d.kind === "food") { visitId = foodQueue.pop(); if (!visitId) d = pick(byKind("prayer")); }
  if (!visitId) visitId = pick(visits);
  const id = randomUUID();
  const kind = d.kind;
  const data = kind === "food" || kind === "clothing" ? { items: [{ item_id: itemFor[d.station], qty: 1 }], for: "self" }
    : kind === "prayer" ? { focus: ["Health"], decision: Math.random() < 0.05 ? "salvation" : "none", wants_followup: false, join_fellowship: false }
    : kind === "medical" ? { tests: ["BP"], referred: false, items: [{ item_id: itemFor[d.station], qty: 1 }] }
    : { category: "Grief", followup_needed: false, risk: "none", refer_medical: false };
  const rec = { id, edition_id: editionId, visit_id: visitId, station_id: d.station, session_id: d.session.id, served_by_name: "Load", summary: `${kind} service`, data, has_confidential: kind === "medical" || kind === "counselling", served_at: new Date().toISOString() };
  await timed(() => d.sb.from("service_records").upsert(rec, { onConflict: "id", ignoreDuplicates: true }));
  if (Math.random() < 0.1) { retriedDupes++; await timed(() => d.sb.from("service_records").upsert(rec, { onConflict: "id", ignoreDuplicates: true })); }
  if (rec.has_confidential) await timed(() => d.sb.from("confidential_records").upsert({ service_record_id: id, edition_id: editionId, visit_id: visitId, kind, payload: { notes: "load" } }, { onConflict: "service_record_id", ignoreDuplicates: true }));
  expected.add(id);
});
const svcSecs = (performance.now() - tB) / 1000;
console.log(`✓ Phase B: ${SERVICES} services in ${svcSecs.toFixed(1)} s (${(SERVICES / svcSecs).toFixed(0)}/s)`);
await sleep(3000); // let realtime drain

// Verify against ground truth (admin, RLS-scoped) and the dashboard RPC
const count = async (table) => (await admin.from(table).select("*", { count: "exact", head: true }).eq("edition_id", editionId)).count;
const [vCount, rCount] = [await count("visits"), await count("service_records")];
const { data: stats } = await admin.rpc("dashboard_stats", { p_edition: editionId });
const { data: inv } = await admin.from("inventory_items").select("name, opening_qty, remaining").eq("edition_id", editionId);
const sorted = [...lat].sort((a, b) => a - b);
const q = (p) => sorted[Math.floor((sorted.length - 1) * p)].toFixed(0);

console.log("\n=== Results ===");
console.log(`Requests: ${lat.length} · duplicate retries sent: ${retriedDupes} · permanent errors: ${errors}`);
if (errSamples.size) console.log("Errors:", Object.fromEntries(errSamples));
console.log(`Latency ms: p50 ${q(0.5)} · p95 ${q(0.95)} · p99 ${q(0.99)} · max ${sorted.at(-1).toFixed(0)}`);
console.log(`Visits: ${vCount} (expected ${PEOPLE}) · Services: ${rCount} (expected ${expected.size})`);
console.log(`Dashboard: registered ${stats.kpis.registered}, services ${stats.kpis.services}`);
console.log(`Stock used: ${inv.map((i) => `${i.name} ${i.opening_qty - i.remaining}`).join(", ")}`);
console.log(`Realtime events received across ${listeners.length} listeners: ${rtEvents} (ideal ${listeners.length * expected.size})`);

const ok = vCount === PEOPLE && rCount === expected.size && stats.kpis.registered === PEOPLE && stats.kpis.services === expected.size && errors === 0;
await admin.from("editions").update({ status: "closed" }).eq("id", editionId);
await admin.from("editions").update({ archived_at: new Date().toISOString() }).eq("id", editionId);
console.log(ok ? "\n✅ PASS: zero lost or duplicated records; dashboard matches ground truth." : "\n❌ FAIL");
console.log(`(Edition "Load test ${prefix}" was closed and archived.)`);
process.exit(ok ? 0 : 1);
