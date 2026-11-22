"use client";
import { uuidv7 } from "uuidv7";
import { db, getMeta, setMeta, type InsertTable, type LocalNeed, type LocalRecord, type LocalVisit, type OutboxOp } from "./db";
import { getSession, type CodeBlock, type VolunteerSession } from "./session";
import { pushOutbox, refreshCounts } from "./sync";
import { firstName, normalizePhone } from "@/lib/utils";
import type { RegistrationDetails } from "@/lib/schemas/beneficiary";

// All volunteer writes go through here (CLAUDE.md): Dexie + outbox in ONE transaction.

const nowIso = () => new Date().toISOString();

function insertOp(table: InsertTable, payload: Record<string, unknown>, label?: string, ref_id?: string): OutboxOp {
  return { op_id: uuidv7(), kind: "insert", table, payload, created_at: nowIso(), attempts: 0, status: "pending", label, ref_id };
}
function rpcOp(fn: string, args: Record<string, unknown>, label?: string, ref_id?: string): OutboxOp {
  return { op_id: uuidv7(), kind: "rpc", fn, args, created_at: nowIso(), attempts: 0, status: "pending", label, ref_id };
}

async function requireSession(): Promise<VolunteerSession> {
  const s = await getSession();
  if (!s) throw new Error("No active station session");
  if (s.edition.status === "closed") throw new Error("This edition is closed. Records are read-only.");
  return s;
}

function afterWrite() {
  void refreshCounts();
  void pushOutbox();
}

// ---------------------------------------------------------------------------
// Registration (FR-3.x)
// ---------------------------------------------------------------------------
export type ExistingBeneficiary = {
  beneficiary_id: string; full_name: string; age_range: LocalVisit["age_range"]; gender: LocalVisit["gender"];
  community: string | null; language: string | null; phone_last4: string | null; returning: boolean;
};

export async function registerPerson(input: {
  details: RegistrationDetails;
  cardCode: string | null;
  needStationIds: string[];
  consentFollowup: boolean;
  existing?: ExistingBeneficiary | null;
}): Promise<LocalVisit> {
  const s = await requireSession();
  const d = db();
  const at = nowIso();
  const beneficiaryId = input.existing?.beneficiary_id ?? uuidv7();
  const visitId = uuidv7();
  const phone = normalizePhone(input.details.phone);
  const ops: OutboxOp[] = [];
  const name = firstName(input.details.full_name);

  if (!input.existing) {
    ops.push(insertOp("beneficiaries", {
      id: beneficiaryId, org_id: s.edition.org_id, full_name: input.details.full_name.trim(), phone,
      gender: input.details.gender, age_range: input.details.age_range, community: input.details.community?.trim() || null,
      language: input.details.language || null, church_member: input.details.church_member || null,
      guardian_name: input.details.guardian_name?.trim() || null,
    }, `Register ${name}`));
  }
  ops.push(insertOp("visits", {
    id: visitId, edition_id: s.edition.id, beneficiary_id: beneficiaryId, card_code: input.cardCode,
    household_size: input.details.household_size ?? null, registered_by_session: s.session.id,
    registered_by_name: s.session.display_name, registered_at: at, consent_data_at: at,
    consent_followup_at: input.consentFollowup ? at : null, consent_version: s.org.consent_version, client_updated_at: at,
  }, `Visit for ${name}`, visitId));
  for (const stationId of input.needStationIds) {
    ops.push(insertOp("visit_needs", { visit_id: visitId, station_id: stationId, edition_id: s.edition.id, state: "pending", source: "registration" }, `Needs for ${name}`));
  }

  const visit: LocalVisit = {
    id: visitId, edition_id: s.edition.id, beneficiary_id: beneficiaryId, card_code: input.cardCode,
    household_size: input.details.household_size ?? null, status: "active", registered_at: at,
    registered_by_name: s.session.display_name, checked_out_at: null, consent_followup: input.consentFollowup, updated_at: at,
    full_name: input.existing?.full_name ?? input.details.full_name.trim(),
    phone_last4: phone ? phone.slice(-4) : input.existing?.phone_last4 ?? null,
    gender: input.existing?.gender ?? input.details.gender, age_range: input.existing?.age_range ?? input.details.age_range,
    community: input.existing?.community ?? (input.details.community?.trim() || null),
    language: input.existing?.language ?? (input.details.language || null), church_member: input.details.church_member ?? null,
    guardian_name: input.details.guardian_name?.trim() || null, returning: input.existing?.returning ?? false, _local: true,
  };
  const needs: LocalNeed[] = input.needStationIds.map((station_id) => ({
    visit_id: visitId, station_id, edition_id: s.edition.id, state: "pending", source: "registration", state_at: at, declined_reason: null, updated_at: at,
  }));

  await d.transaction("rw", [d.visits, d.needs, d.outbox], async () => {
    await d.visits.put(visit);
    if (needs.length) await d.needs.bulkPut(needs);
    await d.outbox.bulkAdd(ops);
  });
  afterWrite();
  return visit;
}

/**
 * Codes for the QR slip printed at registration. They share one sequence with
 * the pre-printed cards (GO26-0001, GO26-0002 ...), so people only need the
 * number. Each phone holds a block of 200 numbers reserved while online and
 * fetches the next block in the background when fewer than 50 are left, so a
 * desk can keep printing offline.
 */
export async function nextOnTheSpotCode(): Promise<string | null> {
  let block = await getMeta<CodeBlock>("code_block");
  if (!block || block.next_value > block.range_end) {
    const spare = await getMeta<CodeBlock>("code_block_next");
    if (!spare) { void refillCodeBlock(); return null; }
    block = spare;
    await setMeta("code_block_next", null);
  }
  // Old-style blocks (GO26-R3) keep their 3-digit suffix; plain blocks pad to 4 like the cards.
  const code = `${block.prefix}-${String(block.next_value).padStart(/-R\d+$/.test(block.prefix) ? 3 : 4, "0")}`;
  await setMeta("code_block", { ...block, next_value: block.next_value + 1 });
  if (block.range_end - block.next_value < 50) void refillCodeBlock();
  return code;
}

/** How many printable codes this phone can still hand out offline. */
export async function codesLeft(): Promise<number> {
  const left = (b: CodeBlock | null | undefined) => (b ? Math.max(0, b.range_end - b.next_value + 1) : 0);
  return left(await getMeta<CodeBlock>("code_block")) + left(await getMeta<CodeBlock>("code_block_next"));
}

let refilling = false;
async function refillCodeBlock() {
  if (refilling || typeof navigator === "undefined" || navigator.onLine === false) return;
  if (await getMeta<CodeBlock>("code_block_next")) return;
  refilling = true;
  try {
    const { volunteerClient } = await import("@/lib/supabase/volunteer");
    const { data } = await (await volunteerClient()).rpc("reserve_code_block", { p_size: 200, p_new: true });
    if (data) await setMeta("code_block_next", data);
  } catch {
    // Offline or capped: the desk can still use pre-printed cards or search by name.
  } finally {
    refilling = false;
  }
}

// ---------------------------------------------------------------------------
// Service records (FR-6.x) — append-only
// ---------------------------------------------------------------------------
export async function recordService(input: {
  visit: LocalVisit;
  summary: string;
  data: Record<string, unknown>;
  confidential?: { kind: "medical" | "counselling"; payload: Record<string, unknown> } | null;
  flags?: { kind: string; scope: "all" | "medical" | "counselling" | "leads"; text: string }[];
}): Promise<string> {
  const s = await requireSession();
  const d = db();
  const id = uuidv7();
  const at = nowIso();
  const name = firstName(input.visit.full_name);
  const ops: OutboxOp[] = [
    insertOp("service_records", {
      id, edition_id: s.edition.id, visit_id: input.visit.id, station_id: s.station.id, session_id: s.session.id,
      served_by_name: s.session.display_name, summary: input.summary, data: input.data,
      has_confidential: !!input.confidential, served_at: at,
    }, `${s.station.name} for ${name}`, id),
  ];
  if (input.confidential) {
    ops.push(insertOp("confidential_records", {
      service_record_id: id, edition_id: s.edition.id, visit_id: input.visit.id, kind: input.confidential.kind, payload: input.confidential.payload,
    }, `${s.station.name} notes for ${name}`, id));
  }
  for (const f of input.flags ?? []) {
    ops.push(insertOp("flags", { id: uuidv7(), edition_id: s.edition.id, visit_id: input.visit.id, kind: f.kind, scope: f.scope, text: f.text, created_by_session: s.session.id }, `Alert for ${name}`, id));
  }

  const record: LocalRecord = {
    id, visit_id: input.visit.id, station_id: s.station.id, served_by_name: s.session.display_name, summary: input.summary,
    data: input.data, has_confidential: !!input.confidential, served_at: at, voided_at: null, updated_at: at, _local: true,
  };
  const items = Array.isArray(input.data.items) ? (input.data.items as { item_id: string; qty: number }[]) : [];

  await d.transaction("rw", [d.records, d.confidential, d.needs, d.inventory, d.outbox], async () => {
    await d.records.put(record);
    if (input.confidential) {
      await d.confidential.put({ service_record_id: id, visit_id: input.visit.id, kind: input.confidential.kind, payload: input.confidential.payload, created_at: at });
    }
    await d.needs.put({ visit_id: input.visit.id, station_id: s.station.id, edition_id: s.edition.id, state: "served", source: "walk_in", state_at: at, declined_reason: null, updated_at: at });
    for (const it of items) {
      const inv = await d.inventory.get(it.item_id);
      if (inv) await d.inventory.update(it.item_id, { remaining: inv.remaining - it.qty });
    }
    await d.outbox.bulkAdd(ops);
  });
  afterWrite();
  return id;
}

/** Undo (FR-6.8/6.9): drop unsynced ops locally, or void on the server (append-only). */
export async function undoService(recordId: string): Promise<void> {
  const s = await requireSession();
  const d = db();
  const record = await d.records.get(recordId);
  if (!record) return;
  const pendingOps = await d.outbox.where("ref_id").equals(recordId).toArray();
  const insertStillQueued = pendingOps.some((o) => o.kind === "insert" && o.table === "service_records");
  const items = Array.isArray(record.data.items) ? (record.data.items as { item_id: string; qty: number }[]) : [];

  await d.transaction("rw", [d.records, d.confidential, d.needs, d.inventory, d.outbox], async () => {
    for (const it of items) {
      const inv = await d.inventory.get(it.item_id);
      if (inv) await d.inventory.update(it.item_id, { remaining: inv.remaining + it.qty });
    }
    const others = (await d.records.where("visit_id").equals(record.visit_id).toArray())
      .filter((r) => r.id !== recordId && r.station_id === record.station_id && !r.voided_at);
    if (!others.length) await d.needs.update([record.visit_id, record.station_id], { state: "pending", updated_at: nowIso() });

    if (insertStillQueued) {
      await d.outbox.bulkDelete(pendingOps.map((o) => o.seq!));
      await d.records.delete(recordId);
      await d.confidential.delete(recordId);
    } else {
      await d.records.update(recordId, { voided_at: nowIso() });
      await d.outbox.add(rpcOp("void_service_record", { p_id: recordId, p_reason: "undo" }, `Undo ${s.station.name}`, recordId));
    }
  });
  afterWrite();
}

// ---------------------------------------------------------------------------
// Needs: decline / refer (FR-6.7)
// ---------------------------------------------------------------------------
export async function setNeed(visit: LocalVisit, stationId: string, state: "pending" | "declined" | "referred", reason?: string) {
  const s = await requireSession();
  const d = db();
  const at = nowIso();
  const current = await d.needs.get([visit.id, stationId]);
  if (current?.state === "served" && state !== "referred") return;
  // The referral alert itself is created server-side (and arrives via realtime/delta).
  await d.transaction("rw", [d.needs, d.outbox], async () => {
    await d.needs.put({
      visit_id: visit.id, station_id: stationId, edition_id: s.edition.id,
      state: state === "referred" && current?.state === "pending" ? "pending" : state,
      source: state === "referred" ? `referral:${s.station.id}` : current?.source ?? "registration",
      state_at: at, declined_reason: state === "declined" ? reason ?? null : null, updated_at: at,
    });
    await d.outbox.add(rpcOp("set_need", { p_visit: visit.id, p_station: stationId, p_state: state, p_reason: reason ?? null }, `${state === "declined" ? "Not available" : state === "referred" ? "Referral" : "Need"} for ${firstName(visit.full_name)}`));
  });
  afterWrite();
}

// ---------------------------------------------------------------------------
// Edits (FR-5.6) — field-level LWW via apply_patch
// ---------------------------------------------------------------------------
export async function patchBeneficiary(visit: LocalVisit, fields: { full_name?: string; phone?: string | null; community?: string | null }) {
  await requireSession();
  const d = db();
  const at = nowIso();
  const serverFields: Record<string, unknown> = {};
  const local: Partial<LocalVisit> = { updated_at: at };
  if (fields.full_name !== undefined) { serverFields.full_name = fields.full_name.trim(); local.full_name = fields.full_name.trim(); }
  if (fields.community !== undefined) { serverFields.community = fields.community?.trim() || null; local.community = fields.community?.trim() || null; }
  if (fields.phone !== undefined) {
    const p = normalizePhone(fields.phone);
    serverFields.phone = p;
    local.phone_last4 = p ? p.slice(-4) : null;
  }
  if (!Object.keys(serverFields).length) return;
  await d.transaction("rw", [d.visits, d.outbox], async () => {
    await d.visits.update(visit.id, local);
    await d.outbox.add(rpcOp("apply_patch", { p_table: "beneficiaries", p_id: visit.beneficiary_id, p_fields: serverFields, p_client_updated_at: at }, `Edit ${firstName(visit.full_name)}`));
  });
  afterWrite();
}

export async function checkOut(visit: LocalVisit) {
  await requireSession();
  const d = db();
  const at = nowIso();
  await d.transaction("rw", [d.visits, d.outbox], async () => {
    await d.visits.update(visit.id, { status: "checked_out", checked_out_at: at, updated_at: at });
    await d.outbox.add(rpcOp("apply_patch", { p_table: "visits", p_id: visit.id, p_fields: { status: "checked_out", checked_out_at: at }, p_client_updated_at: at }, `Check out ${firstName(visit.full_name)}`));
  });
  afterWrite();
}

export async function replaceCard(visit: LocalVisit, newCode: string) {
  await requireSession();
  const d = db();
  await d.transaction("rw", [d.visits, d.outbox], async () => {
    await d.visits.update(visit.id, { card_code: newCode, updated_at: nowIso() });
    await d.outbox.add(rpcOp("replace_card", { p_visit: visit.id, p_new_code: newCode, p_reason: "lost" }, `Replace card for ${firstName(visit.full_name)}`));
  });
  afterWrite();
}
