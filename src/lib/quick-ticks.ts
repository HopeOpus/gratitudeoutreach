/**
 * The quick checklist a station ticks after scanning someone's QR.
 *
 * Each station gets a short list of plain outcomes ("Prayed for", "Received
 * food"). Ticks are turned into the same service record shape the detailed
 * forms produce, so follow-ups, inventory, the dashboard and exports keep
 * working. Summaries stay free of confidential content (DataModel §3). The
 * medical stations and Counselling use full forms (components/station/forms).
 */
import type { StationKind } from "@/lib/stations";
import type { LocalInventory } from "@/lib/offline/db";
import { counsellingSummary } from "@/lib/summary";

export type Tick = { id: string; label: string; short: string; defaultOn?: boolean };

export type QuickPayload = {
  summary: string;
  data: Record<string, unknown>;
  confidential?: { kind: "medical" | "counselling"; payload: Record<string, unknown> } | null;
};

const COUNSELLING: Tick[] = [
  { id: "counselled", label: "Has been counselled", short: "Counselled", defaultOn: true },
  { id: "followup", label: "Needs a follow-up", short: "Follow-up" },
];

const GENERIC: Tick[] = [{ id: "served", label: "Has been served", short: "Served", defaultOn: true }];

const FOOD: Tick[] = [{ id: "received", label: "Has received food", short: "Food", defaultOn: true }];
const CLOTHING: Tick[] = [{ id: "received", label: "Has received clothes", short: "Clothes", defaultOn: true }];

/** Food and clothing can also say which stock items were given (optional, qty 1 each, decrements stock). */
export function itemChoicesFor(kind: StationKind, items: LocalInventory[]): LocalInventory[] {
  return kind === "food" || kind === "clothing" ? items : [];
}

export function ticksFor(kind: StationKind): Tick[] {
  switch (kind) {
    case "counselling": return COUNSELLING;
    case "food": return FOOD;
    case "clothing": return CLOTHING;
    default: return GENERIC;
  }
}

export function defaultTicks(kind: StationKind): string[] {
  return ticksFor(kind).filter((t) => t.defaultOn).map((t) => t.id);
}

function truncate(s: string, n = 140) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** One medicine on a prescription. `name` is kept so Pharmacy can read it even if stock is renamed. */
export type RxLine = { item_id: string; name: string; qty: number; dosage?: string; custom?: boolean };

export type PharmacyInput = {
  /** What was handed over, and the medical record it fills (null = no prescription). */
  /** `custom` lines were typed in by the doctor (not in the inventory), so they never touch stock. */
  dispensed: { item_id: string; qty: number; custom?: boolean }[];
  prescriptionId: string | null;
  counsellingRecordId: string | null;
  /** Station Lead approval when Counselling is not done. */
  override?: string;
};

/** Pharmacy closes the step with medicine given, not available, or none needed. The summary never says which. */
export function buildPharmacyPayload(p: PharmacyInput): QuickPayload {
  const handed = p.dispensed.filter((l) => l.qty > 0);
  const given = handed.filter((l) => !l.custom).map((l) => ({ item_id: l.item_id, qty: l.qty }));
  const outcome = handed.length ? "Medicine given" : p.prescriptionId ? "Medicine not available" : "No medicine needed";
  return {
    summary: "Pharmacy completed",
    data: {
      items: given, outcomes: [outcome],
      ...(p.prescriptionId ? { prescription_id: p.prescriptionId } : {}),
      ...(p.counsellingRecordId ? { counselling_record_id: p.counsellingRecordId } : {}),
      ...(p.override ? { override_by: p.override } : {}),
    },
  };
}

/** Turns ticked ids (and optional stock items given) into a service record. `done` must not be empty. */
export function buildQuickPayload(kind: StationKind, done: string[], items: LocalInventory[] = [], pickedItemIds: string[] = []): QuickPayload {
  const ticks = ticksFor(kind).filter((t) => done.includes(t.id));
  if (!ticks.length) throw new Error("Tick at least one thing that was done.");
  const has = (id: string) => done.includes(id);
  const outcomes = ticks.map((t) => t.short);

  switch (kind) {
    case "counselling":
      return {
        summary: counsellingSummary(),
        data: { category: "General", followup_needed: has("followup"), risk: "none", refer_medical: false, outcomes },
      };
    case "food":
    case "clothing": {
      const given = items.filter((i) => pickedItemIds.includes(i.id));
      const picked = given.map((i) => ({ item_id: i.id, qty: 1 }));
      const data = kind === "food" ? { items: picked, outcomes } : { items: picked, for: "self", outcomes };
      return { summary: truncate(given.length ? given.map((i) => i.name).join(", ") : outcomes.join(", ")), data };
    }
    default:
      return { summary: truncate(outcomes.join(" · ")), data: { outcomes } };
  }
}
