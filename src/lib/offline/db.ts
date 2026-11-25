"use client";
import Dexie, { type Table } from "dexie";
import type { StationKind } from "@/lib/stations";

// Local mirror of the edition (Architecture §4). Confidential rows only ever
// arrive on devices whose session is allowed to read them (RLS-filtered snapshot).

export type NeedState = "pending" | "served" | "declined" | "referred";

export interface LocalVisit {
  id: string;
  edition_id: string;
  beneficiary_id: string;
  card_code: string | null;
  household_size: number | null;
  status: "active" | "checked_out";
  registered_at: string;
  registered_by_name: string | null;
  checked_out_at: string | null;
  consent_followup: boolean;
  updated_at: string;
  full_name: string;
  phone_last4: string | null;
  gender: "female" | "male" | "undisclosed" | null;
  age_range: "0-12" | "13-17" | "18-35" | "36-59" | "60+" | null;
  community: string | null;
  language: string | null;
  church_member: string | null;
  guardian_name: string | null;
  returning: boolean;
  deleted?: boolean;
  _local?: boolean; // created on this device, not yet confirmed by server
}

export interface LocalNeed {
  visit_id: string;
  station_id: string;
  edition_id: string;
  state: NeedState;
  source: string;
  state_at: string;
  declined_reason: string | null;
  updated_at: string;
}

export interface LocalRecord {
  id: string;
  visit_id: string;
  station_id: string;
  served_by_name: string;
  summary: string;
  data: Record<string, unknown>;
  has_confidential: boolean;
  served_at: string;
  voided_at: string | null;
  updated_at: string;
  _local?: boolean;
}

export type ConfidentialKind = "medical" | "counselling" | "spiritual";

export interface LocalConfidential {
  service_record_id: string;
  visit_id: string;
  kind: ConfidentialKind;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface LocalFlag {
  id: string;
  edition_id: string;
  visit_id: string;
  kind: string;
  scope: "all" | "medical" | "counselling" | "leads";
  text: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalInventory {
  id: string;
  station_id: string;
  name: string;
  unit: string;
  sizes: string[] | null;
  opening_qty: number;
  remaining: number;
  low_threshold: number;
  updated_at: string;
}

export interface LocalStation {
  id: string;
  edition_id: string;
  kind: StationKind;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  enabled: boolean;
  is_service: boolean;
}

export type InsertTable = "beneficiaries" | "visits" | "visit_needs" | "service_records" | "confidential_records" | "flags";

export interface OutboxBase {
  seq?: number;
  op_id: string;
  created_at: string;
  attempts: number;
  status: "pending" | "failed";
  last_error?: string;
  next_attempt_at?: number;
  label?: string; // human description for the sync review list (no personal data beyond first name)
  ref_id?: string; // service record id etc., used by undo
}
export type OutboxOp =
  | (OutboxBase & { kind: "insert"; table: InsertTable; payload: Record<string, unknown> })
  | (OutboxBase & { kind: "rpc"; fn: string; args: Record<string, unknown> });

export interface MetaRow {
  key: string;
  value: unknown;
}

class GratitudeDB extends Dexie {
  visits!: Table<LocalVisit, string>;
  needs!: Table<LocalNeed, [string, string]>;
  records!: Table<LocalRecord, string>;
  confidential!: Table<LocalConfidential, string>;
  flags!: Table<LocalFlag, string>;
  inventory!: Table<LocalInventory, string>;
  stations!: Table<LocalStation, string>;
  outbox!: Table<OutboxOp, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("gratitude-connect");
    this.version(1).stores({
      visits: "id, card_code, beneficiary_id, registered_at",
      needs: "[visit_id+station_id], visit_id, station_id, [station_id+state]",
      records: "id, visit_id, station_id, served_at",
      confidential: "service_record_id, visit_id",
      flags: "id, visit_id",
      inventory: "id, station_id",
      stations: "id, sort_order",
      outbox: "++seq, op_id, status, ref_id",
      meta: "key",
    });
  }
}

let _db: GratitudeDB | null = null;
let locked = false;
export class SessionEndedError extends Error {
  name = "SessionEndedError";
  constructor() { super("Session ended: local data is locked"); }
}
export function db(): GratitudeDB {
  // After a session ends this page may still have sync calls in flight; they must
  // never re-create data on a wiped (revoked/expired) device.
  if (locked) throw new SessionEndedError();
  if (!_db) _db = new GratitudeDB();
  return _db;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db().meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db().meta.put({ key, value });
}

/** Wipe everything on this device. With `lock`, nothing can write again until the page reloads. */
export async function purgeLocalData(opts: { lock?: boolean } = {}) {
  const d = _db ?? new GratitudeDB();
  if (opts.lock) locked = true;
  d.close();
  await Dexie.delete("gratitude-connect");
  _db = null;
}
