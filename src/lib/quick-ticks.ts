/**
 * The quick checklist a station ticks after scanning someone's QR.
 *
 * Each station gets a short list of plain outcomes ("Prayed for", "Received
 * food"). Ticks are turned into the same service record shape the detailed
 * forms produce, so follow-ups, inventory, the dashboard and exports keep
 * working. Summaries stay free of confidential content (DataModel §3): medical
 * ticks other than "referred" go into the confidential record only.
 */
import type { StationKind } from "@/lib/stations";
import type { LocalInventory } from "@/lib/offline/db";
import { counsellingSummary, medicalSummary } from "@/lib/summary";

export type Tick = { id: string; label: string; short: string; defaultOn?: boolean };

export type QuickPayload = {
  summary: string;
  data: Record<string, unknown>;
  confidential?: { kind: "medical" | "counselling"; payload: Record<string, unknown> } | null;
};

const PRAYER: Tick[] = [
  { id: "prayed", label: "Has been prayed for", short: "Prayed for", defaultOn: true },
  { id: "healing", label: "Received healing", short: "Healing" },
  { id: "salvation", label: "Gave their life to Christ", short: "Salvation" },
  { id: "rededication", label: "Rededicated their life", short: "Rededication" },
  { id: "followup", label: "Wants a follow-up visit or call", short: "Wants follow-up" },
];

const MEDICAL: Tick[] = [
  { id: "seen", label: "Seen by the medical team", short: "Seen", defaultOn: true },
  { id: "medication", label: "Given medication", short: "Medication" },
  { id: "referred", label: "Referred to a hospital or clinic", short: "Referred" },
];

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
    case "prayer": return PRAYER;
    case "medical": return MEDICAL;
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

/** Turns ticked ids (and optional stock items given) into a service record. `done` must not be empty. */
export function buildQuickPayload(kind: StationKind, done: string[], items: LocalInventory[] = [], pickedItemIds: string[] = []): QuickPayload {
  const ticks = ticksFor(kind).filter((t) => done.includes(t.id));
  if (!ticks.length) throw new Error("Tick at least one thing that was done.");
  const has = (id: string) => done.includes(id);
  const outcomes = ticks.map((t) => t.short);

  switch (kind) {
    case "prayer": {
      const decision = has("salvation") ? "salvation" : has("rededication") ? "rededication" : "none";
      return {
        summary: truncate(outcomes.join(" · ")),
        data: { focus: has("healing") ? ["Health"] : [], decision, wants_followup: has("followup"), join_fellowship: false, outcomes },
      };
    }
    case "medical": {
      const referred = has("referred");
      return {
        summary: medicalSummary({ referred }),
        data: { tests: [], referred, items: [], ...(referred ? { referral_urgency: "routine" } : {}) },
        confidential: { kind: "medical", payload: { vitals: {}, complaint: [], dispensed: [], designation: "Other", outcomes } },
      };
    }
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
