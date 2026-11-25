/**
 * The order people move through the outreach:
 * Registration > Medical Assistant > General Doctor (> Optician / Laboratory) > Counselling > Pharmacy > Clothing and Food.
 * Counselling before Pharmacy is enforced (here and by a database trigger); the rest is guidance.
 */
import type { LocalNeed, LocalRecord, LocalStation } from "@/lib/offline/db";
import { isMedicalKind, isPrivateKind, type StationKind } from "@/lib/stations";

/** Everyone goes to these, so Registration does not ask. */
export const COMPULSORY_KINDS: StationKind[] = ["medical_assistant", "prayer", "pharmacy"];
const ORDER: StationKind[] = ["medical_assistant", "medical", "optician", "laboratory", "prayer", "pharmacy", "clothing", "food"];

/** The need tiles Registration offers. */
export const isOptionalNeed = (s: Pick<LocalStation, "kind" | "is_service" | "enabled">) =>
  s.is_service && s.enabled && ["medical", "food", "clothing", "custom"].includes(s.kind);

/** Laboratory and Optician are visible to the medical team only. */
export const canSeeStation = (viewer: StationKind | string, s: Pick<LocalStation, "kind">) => !isPrivateKind(s.kind) || isMedicalKind(viewer);

/** One station per compulsory kind: the first enabled one (same rule as the database). */
export function compulsoryStations(stations: LocalStation[]): LocalStation[] {
  return COMPULSORY_KINDS.flatMap((k) => {
    const s = stations.filter((x) => x.kind === k && x.enabled).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))[0];
    return s ? [s] : [];
  });
}

export function isCounsellingRecord(kind: string | undefined, data: Record<string, unknown>): boolean {
  if (kind === "counselling") return true;
  if (kind !== "prayer") return false;
  return data.counselled === true || (Array.isArray(data.outcomes) && data.outcomes.includes("Counselled"));
}

/** The counselling record that opens Pharmacy, or null. Pass records that are not voided. */
export function counsellingRecord(records: LocalRecord[], stations: LocalStation[]): LocalRecord | null {
  const kinds = new Map(stations.map((s) => [s.id, s.kind]));
  return records.find((r) => !r.voided_at && isCounsellingRecord(kinds.get(r.station_id), r.data)) ?? null;
}

/** No Counselling station switched on means nothing to wait for (same rule as the database). */
export const counsellingRequired = (stations: LocalStation[]) => stations.some((s) => s.enabled && (s.kind === "prayer" || s.kind === "counselling"));

type Ctx = { stations: LocalStation[]; needs: LocalNeed[]; records: LocalRecord[] };

function outstanding(kind: StationKind, { stations, needs, records }: Ctx): LocalStation | null {
  const own = stations.filter((s) => s.kind === kind && s.enabled);
  if (!own.length) return null;
  if (kind === "prayer") return counsellingRecord(records, stations) ? null : own[0]!;
  const ids = new Set(own.map((s) => s.id));
  const mine = needs.filter((n) => ids.has(n.station_id));
  const waiting = mine.find((n) => n.state === "pending" || n.state === "referred");
  const served = records.some((r) => ids.has(r.station_id) && !r.voided_at);
  if (COMPULSORY_KINDS.includes(kind)) return served || (mine.length > 0 && !waiting) ? null : own[0]!;
  return waiting ? own.find((s) => s.id === waiting.station_id) ?? own[0]! : null;
}

/** Where this person should go next, as far as this phone knows. */
export function nextStop(ctx: Ctx, viewer: StationKind | string): LocalStation | null {
  for (const k of ORDER) {
    const s = outstanding(k, ctx);
    if (s && canSeeStation(viewer, s)) return s;
  }
  return null;
}

/** Earlier steps not done yet, to warn about at `kind`. */
export function missingBefore(kind: StationKind | string, ctx: Ctx): LocalStation[] {
  const at = ORDER.indexOf(kind as StationKind);
  if (at <= 0) return [];
  // Medical Assistant is the only step expected before the doctor; the lab and optician come from the doctor.
  const before = kind === "food" || kind === "clothing" ? (["pharmacy"] as StationKind[])
    : ORDER.slice(0, at).filter((k) => !((kind === "optician" || kind === "laboratory") && k !== "medical_assistant"));
  return before.flatMap((k) => {
    const s = outstanding(k, ctx);
    return s && canSeeStation(kind, s) ? [s] : [];
  });
}
