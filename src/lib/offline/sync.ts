"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { volunteerClient } from "@/lib/supabase/volunteer";
import {
  db, getMeta, setMeta, purgeLocalData,
  type LocalConfidential, type LocalFlag, type LocalInventory, type LocalNeed, type LocalRecord, type LocalStation, type LocalVisit, type OutboxOp,
} from "./db";
import { getSession, saveSession, type VolunteerSession } from "./session";
import { setSyncState, getSyncState } from "./sync-state";

const BATCH = 50;
const MAX_BACKOFF_MS = 60_000;
const CONFLICT_TARGET: Record<string, string> = {
  beneficiaries: "id",
  visits: "id",
  visit_needs: "visit_id,station_id",
  service_records: "id",
  confidential_records: "service_record_id",
  flags: "id",
};

type PgError = { code?: string; message?: string; hint?: string; details?: string } | null;

/** Network / server / auth hiccups are retried; validation and permission errors are kept for review. */
export function isRetryable(err: PgError): boolean {
  if (!err) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const code = err.code ?? "";
  if (!code) return true; // fetch failed
  if (code.startsWith("PGRST3")) return true; // JWT problems: refresh + retry
  if (code === "57014" || code === "40001" || code === "40P01" || code.startsWith("08") || code.startsWith("53")) return true;
  return false;
}

export async function refreshCounts() {
  const d = db();
  const [pending, failed] = await Promise.all([
    d.outbox.where("status").equals("pending").count(),
    d.outbox.where("status").equals("failed").count(),
  ]);
  setSyncState({ pending, failed });
  return { pending, failed };
}

async function oldestPendingAt(): Promise<string | null> {
  const first = await db().outbox.orderBy("seq").first();
  return first?.created_at ?? null;
}

// ---------------------------------------------------------------------------
// PUSH (outbox → server)
// ---------------------------------------------------------------------------
let pushing = false;

async function sendOp(op: OutboxOp): Promise<PgError> {
  const sb = (await volunteerClient());
  if (op.kind === "insert") {
    const { error } = await sb
      .from(op.table)
      .upsert(op.payload as never, { onConflict: CONFLICT_TARGET[op.table], ignoreDuplicates: true });
    return error;
  }
  const { error } = await sb.rpc(op.fn as never, op.args as never);
  return error;
}

/** Card conflict on a visit: keep the person, drop the card code, and raise a flag for the coordinator. */
async function handleCardConflict(op: OutboxOp & { kind: "insert" }): Promise<PgError> {
  const payload = { ...op.payload, card_code: null };
  const sb = (await volunteerClient());
  const { error } = await sb.from("visits").upsert(payload as never, { onConflict: "id", ignoreDuplicates: true });
  if (error) return error;
  const session = await getSession();
  await db().visits.update(String(op.payload.id), { card_code: null });
  await sb.from("flags").upsert({
    id: crypto.randomUUID(),
    edition_id: String(op.payload.edition_id),
    visit_id: String(op.payload.id),
    kind: "card_conflict",
    scope: "leads",
    text: `Card ${String(op.payload.card_code)} was already used on another device. Give this person a new card.`,
    created_by_session: session?.session.id ?? null,
  } as never, { onConflict: "id", ignoreDuplicates: true });
  return null;
}

export async function pushOutbox(): Promise<void> {
  if (pushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncState({ online: false });
    await refreshCounts();
    return;
  }
  pushing = true;
  setSyncState({ busy: true, online: true });
  const d = db();
  try {
    for (;;) {
      const ops = await d.outbox.where("status").equals("pending").sortBy("seq");
      const due = ops.filter((o) => !o.next_attempt_at || o.next_attempt_at <= Date.now()).slice(0, BATCH);
      if (!due.length) break;
      let stop = false;
      for (const op of due) {
        // Preserve order: never skip ahead of an op that is waiting on backoff.
        const blocked = ops.find((o) => o.seq! < op.seq! && o.next_attempt_at && o.next_attempt_at > Date.now());
        if (blocked) { stop = true; break; }
        let error = await sendOp(op);
        if (error && op.kind === "insert" && op.table === "visits" && error.code === "23505" && op.payload.card_code) {
          error = await handleCardConflict(op);
        }
        if (!error) {
          await d.outbox.delete(op.seq!);
          if (op.kind === "insert" && (op.table === "visits" || op.table === "service_records")) {
            const table = op.table === "visits" ? d.visits : d.records;
            await table.update(String(op.payload.id), { _local: false });
          }
          continue;
        }
        if (isRetryable(error)) {
          const attempts = op.attempts + 1;
          const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts, 6));
          await d.outbox.update(op.seq!, { attempts, last_error: error.message ?? "Network error", next_attempt_at: Date.now() + backoff });
          setSyncState({ lastError: error.message ?? "Network error" });
          stop = true;
          break;
        }
        await d.outbox.update(op.seq!, { status: "failed", attempts: op.attempts + 1, last_error: error.hint || error.message || error.code || "Rejected" });
        setSyncState({ lastError: error.hint || error.message || "Rejected" });
      }
      if (stop) break;
    }
    setSyncState({ lastSyncAt: new Date().toISOString() });
  } finally {
    pushing = false;
    setSyncState({ busy: false });
    await refreshCounts();
  }
}

export async function retryFailed() {
  await db().outbox.where("status").equals("failed").modify({ status: "pending", next_attempt_at: 0 });
  await refreshCounts();
  void pushOutbox();
}

export async function discardOp(seq: number) {
  await db().outbox.delete(seq);
  await refreshCounts();
}

// ---------------------------------------------------------------------------
// PULL (snapshot / delta / realtime)
// ---------------------------------------------------------------------------
type SnapshotPage = {
  page: number; total: number; has_more: boolean; server_time: string;
  visits: LocalVisit[]; needs: LocalNeed[]; records: LocalRecord[]; confidential: LocalConfidential[];
  flags: LocalFlag[]; stations?: LocalStation[]; inventory?: LocalInventory[];
};

async function applyRows(p: Partial<SnapshotPage>) {
  const d = db();
  await d.transaction("rw", [d.visits, d.needs, d.records, d.confidential, d.flags, d.stations, d.inventory], async () => {
    if (p.visits?.length) await d.visits.bulkPut(p.visits.map((v) => ({ ...v, _local: false })));
    if (p.needs?.length) await d.needs.bulkPut(p.needs);
    if (p.records?.length) await d.records.bulkPut(p.records.map((r) => ({ ...r, _local: false })));
    if (p.confidential?.length) await d.confidential.bulkPut(p.confidential);
    if (p.flags?.length) await d.flags.bulkPut(p.flags);
    if (p.stations?.length) await d.stations.bulkPut(p.stations);
    if (p.inventory?.length) await d.inventory.bulkPut(p.inventory);
  });
}

function cursorFrom(serverTime: string) {
  return new Date(new Date(serverTime).getTime() - 5000).toISOString();
}

/** Initial offline cache, paged by 1,000 (FR-13.3). */
export async function loadSnapshot(editionId: string, onProgress?: (done: number, total: number) => void) {
  const sb = (await volunteerClient());
  let page = 0;
  let cursor: string | null = null;
  let done = 0;
  for (;;) {
    const { data, error } = await sb.rpc("edition_snapshot", { p_edition: editionId, p_page: page, p_page_size: 1000 });
    if (error) throw error;
    const snap = data as unknown as SnapshotPage;
    if (page === 0) cursor = cursorFrom(snap.server_time);
    await applyRows(snap);
    done += snap.visits.length;
    onProgress?.(done, snap.total);
    if (!snap.has_more) break;
    page += 1;
  }
  if (cursor) await setMeta("cursor", cursor);
  await setMeta("snapshot_at", new Date().toISOString());
}

let pulling = false;
export async function pullDelta() {
  if (pulling) return;
  const session = await getSession();
  const since = await getMeta<string>("cursor");
  if (!session || !since) return;
  pulling = true;
  try {
    const { data, error } = await (await volunteerClient()).rpc("edition_delta", { p_edition: session.edition.id, p_since: since });
    if (error) return;
    const delta = data as unknown as SnapshotPage;
    await applyRows(delta);
    await setMeta("cursor", cursorFrom(delta.server_time));
  } finally {
    pulling = false;
  }
}

let channel: RealtimeChannel | null = null;
let deltaTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDelta() {
  if (deltaTimer) clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => void pullDelta(), 250);
}

async function subscribeRealtime(editionId: string) {
  const sb = await volunteerClient();
  if (channel) void sb.removeChannel(channel);
  const filter = `edition_id=eq.${editionId}`;
  const d = db();
  channel = sb
    .channel(`edition:${editionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "service_records", filter }, (p) => {
      const r = p.new as Record<string, unknown>;
      if (!r?.id) return;
      void d.records.put({
        id: String(r.id), visit_id: String(r.visit_id), station_id: String(r.station_id), served_by_name: String(r.served_by_name),
        summary: String(r.summary), data: (r.data ?? {}) as Record<string, unknown>, has_confidential: Boolean(r.has_confidential),
        served_at: String(r.served_at), voided_at: (r.voided_at as string | null) ?? null, updated_at: String(r.updated_at),
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "visit_needs", filter }, (p) => {
      const n = p.new as LocalNeed;
      if (n?.visit_id) void d.needs.put(n);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "flags", filter }, (p) => {
      const f = p.new as LocalFlag;
      if (f?.id) void d.flags.put(f);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter }, (p) => {
      const i = p.new as Record<string, unknown>;
      if (!i?.id) return;
      void d.inventory.put({
        id: String(i.id), station_id: String(i.station_id), name: String(i.name), unit: String(i.unit ?? "pcs"),
        sizes: (i.sizes as string[] | null) ?? null, opening_qty: Number(i.opening_qty), remaining: Number(i.remaining),
        low_threshold: Number(i.low_threshold ?? 0), updated_at: String(i.updated_at),
      });
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "confidential_records", filter }, (p) => {
      const c = p.new as LocalConfidential;
      if (c?.service_record_id) void d.confidential.put(c);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter }, () => scheduleDelta())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleDelta(); // catch up anything missed while disconnected
    });
}

// ---------------------------------------------------------------------------
// HEARTBEAT (revocation, moves, closed edition) — every 30 s
// ---------------------------------------------------------------------------
export type HeartbeatOutcome = "ok" | "revoked" | "expired" | "offline";

export async function heartbeat(): Promise<HeartbeatOutcome> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const { pending } = await refreshCounts();
  const { data, error } = await (await volunteerClient()).rpc("heartbeat", { p_pending: pending + getSyncState().failed, p_oldest: (await oldestPendingAt()) ?? undefined });
  if (error) return "offline";
  const hb = data as { active: boolean; revoked: boolean; expired: boolean; edition_status?: string; station_id?: string; role?: string };
  if (!hb.active) return hb.revoked ? "revoked" : "expired";
  const session = await getSession();
  if (session) {
    let changed = false;
    const next: VolunteerSession = structuredClone(session);
    if (hb.edition_status && hb.edition_status !== session.edition.status) {
      next.edition.status = hb.edition_status as VolunteerSession["edition"]["status"];
      changed = true;
    }
    if (hb.station_id && hb.station_id !== session.station.id) {
      const st = await db().stations.get(hb.station_id);
      if (st) {
        next.station = { ...next.station, id: st.id, kind: st.kind, name: st.name, icon: st.icon };
        next.session.station_id = st.id;
        next.session.role = "volunteer";
        changed = true;
      }
    }
    if (changed) await saveSession(next);
    setSyncState({ readOnly: next.edition.status === "closed" });
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// ENGINE
// ---------------------------------------------------------------------------
let started = false;
let timers: ReturnType<typeof setInterval>[] = [];
let onEnd: ((why: "revoked" | "expired") => void) | null = null;

export function startSyncEngine(editionId: string, handleEnd: (why: "revoked" | "expired") => void) {
  onEnd = handleEnd;
  if (started) return;
  started = true;
  const kick = () => {
    setSyncState({ online: navigator.onLine });
    if (navigator.onLine) {
      void pushOutbox();
      void pullDelta();
    }
  };
  const beat = async () => {
    const r = await heartbeat();
    if ((r === "revoked" || r === "expired") && onEnd) { onEnd(r); return; }
    // Safety net: Realtime can drop events under load; a cheap delta every 30 s
    // guarantees every device converges even if a broadcast was missed.
    if (r === "ok") void pullDelta();
  };
  window.addEventListener("online", kick);
  window.addEventListener("offline", () => setSyncState({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  timers = [
    setInterval(() => { if (navigator.onLine) void pushOutbox(); }, 5000),
    setInterval(() => void beat(), 30_000),
  ];
  void subscribeRealtime(editionId);
  kick();
  void beat();
}

export function stopSyncEngine() {
  timers.forEach(clearInterval);
  timers = [];
  started = false;
  const ch = channel;
  channel = null;
  if (ch) void volunteerClient().then((sb) => sb.removeChannel(ch));
}

/** Sign out + wipe device data (revoke, expiry, "Leave station"). */
export async function endSession(opts: { callServer?: boolean } = {}) {
  stopSyncEngine();
  const sb = (await volunteerClient());
  if (opts.callServer && navigator.onLine) {
    await sb.rpc("leave_session").then(() => undefined, () => undefined);
  }
  await purgeLocalData({ lock: true });
  await sb.auth.signOut().catch(() => undefined);
  try { localStorage.removeItem("gc-volunteer-auth"); } catch { /* ignore */ }
}
