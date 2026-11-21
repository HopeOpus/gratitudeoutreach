/**
 * Timeline summary strings (docs/DataModel.md §3). These are visible to EVERY
 * station, so they must never contain confidential content (no notes, no
 * counselling category, no vitals, no diagnosis).
 */
import type { PrayerData, FoodData, ClothingData, MedicalData } from "@/lib/schemas/service";

type ItemNames = Record<string, string>;

export function prayerSummary(d: PrayerData): string {
  const focus = d.focus.length ? d.focus.join(", ") : "Prayer";
  const decision = d.decision === "salvation" ? " · Salvation" : d.decision === "rededication" ? " · Rededication" : "";
  return truncate(`${focus}${decision}`);
}

export function counsellingSummary(): string {
  return "Counselling session";
}

export function medicalSummary(d: Pick<MedicalData, "referred">): string {
  return d.referred ? "Medical check · referred" : "Medical check";
}

export function foodSummary(d: FoodData, names: ItemNames): string {
  if (!d.items.length) return "Food";
  return truncate(d.items.map((i) => `${names[i.item_id] ?? "Item"} ×${i.qty}`).join(", "));
}

export function clothingSummary(d: ClothingData): string {
  const total = d.items.reduce((n, i) => n + i.qty, 0);
  const label = `${total} ${total === 1 ? "item" : "items"}`;
  return d.for === "child" ? `${label} (child)` : d.for === "other" ? `${label} (household)` : label;
}

function truncate(s: string, n = 140) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
