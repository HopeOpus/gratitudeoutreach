import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;
export type Column = { key: string; header: string; width?: number };
export type Dataset = { title: string; columns: Column[]; rows: Record<string, unknown>[] };
export const DATASETS = ["beneficiaries", "visits", "services", "inventory", "followups"] as const;
export type DatasetName = (typeof DATASETS)[number];

const lagos = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "";

/** PostgREST caps responses at 1,000 rows; page through everything. */
async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function base(sb: SB, edition: string) {
  const visits = await all((f, t) => sb.from("visits").select("id, card_code, beneficiary_id, household_size, status, registered_at, registered_by_name, checked_out_at, consent_followup_at")
    .eq("edition_id", edition).is("deleted_at", null).order("registered_at").range(f, t));
  const benIds = [...new Set(visits.map((v) => v.beneficiary_id))];
  const bens: Database["public"]["Tables"]["beneficiaries"]["Row"][] = [];
  for (let i = 0; i < benIds.length; i += 300) {
    const { data } = await sb.from("beneficiaries").select("*").in("id", benIds.slice(i, i + 300));
    bens.push(...(data ?? []));
  }
  const benById = new Map(bens.map((b) => [b.id, b]));
  const { data: stations } = await sb.from("stations_public").select("id, name, kind").eq("edition_id", edition);
  const stationById = new Map((stations ?? []).map((s) => [s.id!, s]));
  const { data: items } = await sb.from("inventory_items").select("id, name").eq("edition_id", edition);
  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));
  return { visits, benById, stationById, itemName };
}

const itemsText = (data: unknown, names: Map<string, string>) => {
  const items = (data as { items?: { item_id: string; qty: number; size?: string }[] })?.items ?? [];
  return items.map((i) => `${names.get(i.item_id) ?? "Item"}${i.size ? ` (${i.size})` : ""} ×${i.qty}`).join("; ");
};

export async function buildDataset(sb: SB, edition: string, name: DatasetName): Promise<Dataset> {
  if (name === "inventory") {
    const items = await all((f, t) => sb.from("inventory_items").select("id, name, unit, opening_qty, remaining, low_threshold, station_id").eq("edition_id", edition).order("name").range(f, t));
    const { data: stations } = await sb.from("stations_public").select("id, name").eq("edition_id", edition);
    const st = new Map((stations ?? []).map((s) => [s.id!, s.name]));
    return {
      title: "Inventory",
      columns: [
        { key: "station", header: "Station", width: 16 }, { key: "name", header: "Item", width: 32 }, { key: "unit", header: "Unit", width: 10 },
        { key: "opening", header: "Opening", width: 10 }, { key: "used", header: "Used", width: 10 }, { key: "remaining", header: "Remaining", width: 11 }, { key: "low", header: "Low threshold", width: 13 },
      ],
      rows: items.map((i) => ({ station: st.get(i.station_id) ?? "", name: i.name, unit: i.unit, opening: i.opening_qty, used: i.opening_qty - i.remaining, remaining: i.remaining, low: i.low_threshold })),
    };
  }

  if (name === "followups") {
    const { data, error } = await sb.rpc("list_followups", { p_edition: edition });
    if (error) throw error;
    return {
      title: "Follow-ups",
      columns: [
        { key: "type", header: "Type", width: 18 }, { key: "status", header: "Status", width: 12 }, { key: "name", header: "Name", width: 26 },
        { key: "card", header: "Card", width: 12 }, { key: "community", header: "Community", width: 14 }, { key: "phone", header: "Phone (consented only)", width: 18 },
        { key: "assignee", header: "Assigned to", width: 18 }, { key: "due", header: "Due", width: 12 }, { key: "outcome", header: "Last outcome", width: 14 }, { key: "note", header: "Last note", width: 40 },
      ],
      rows: (data ?? []).map((f) => ({ type: f.type, status: f.status, name: f.full_name, card: f.card_code, community: f.community, phone: f.phone ?? "",
        assignee: f.assignee_name ?? "", due: f.due_on ?? "", outcome: f.last_outcome ?? "", note: f.last_note ?? "" })),
    };
  }

  const { visits, benById, stationById, itemName } = await base(sb, edition);

  if (name === "beneficiaries") {
    return {
      title: "Beneficiaries",
      columns: [
        { key: "card", header: "Card", width: 12 }, { key: "name", header: "Full name", width: 28 }, { key: "phone", header: "Phone (follow-up consent only)", width: 20 },
        { key: "gender", header: "Gender", width: 10 }, { key: "age", header: "Age range", width: 10 }, { key: "community", header: "Community", width: 14 },
        { key: "language", header: "Language", width: 10 }, { key: "member", header: "Church member", width: 13 }, { key: "household", header: "Household", width: 10 },
        { key: "guardian", header: "Guardian", width: 20 }, { key: "registered", header: "Registered", width: 16 }, { key: "followup", header: "Follow-up consent", width: 15 },
      ],
      rows: visits.map((v) => {
        const b = benById.get(v.beneficiary_id);
        return { card: v.card_code, name: b?.full_name, phone: v.consent_followup_at ? b?.phone ?? "" : "", gender: b?.gender, age: b?.age_range, community: b?.community,
          language: b?.language, member: b?.church_member, household: v.household_size, guardian: b?.guardian_name, registered: lagos(v.registered_at), followup: v.consent_followup_at ? "Yes" : "No" };
      }),
    };
  }

  if (name === "visits") {
    const needs = await all((f, t) => sb.from("visit_needs").select("visit_id, station_id, state").eq("edition_id", edition).range(f, t));
    const byVisit = new Map<string, string[]>();
    needs.forEach((n) => {
      const list = byVisit.get(n.visit_id) ?? [];
      list.push(`${stationById.get(n.station_id)?.name ?? "?"}: ${n.state}`);
      byVisit.set(n.visit_id, list);
    });
    return {
      title: "Visits",
      columns: [
        { key: "card", header: "Card", width: 12 }, { key: "name", header: "Name", width: 28 }, { key: "registered", header: "Registered", width: 16 },
        { key: "by", header: "Registered by", width: 16 }, { key: "status", header: "Status", width: 12 }, { key: "checked_out", header: "Checked out", width: 16 }, { key: "needs", header: "Needs", width: 60 },
      ],
      rows: visits.map((v) => ({ card: v.card_code, name: benById.get(v.beneficiary_id)?.full_name, registered: lagos(v.registered_at), by: v.registered_by_name,
        status: v.status, checked_out: lagos(v.checked_out_at), needs: (byVisit.get(v.id) ?? []).join("; ") })),
    };
  }

  // services (non-confidential fields only)
  const records = await all((f, t) => sb.from("service_records").select("id, visit_id, station_id, served_by_name, summary, data, served_at, voided_at")
    .eq("edition_id", edition).is("voided_at", null).order("served_at").range(f, t));
  const visitById = new Map(visits.map((v) => [v.id, v]));
  return {
    title: "Services",
    columns: [
      { key: "served_at", header: "Time", width: 16 }, { key: "station", header: "Station", width: 14 }, { key: "card", header: "Card", width: 12 },
      { key: "name", header: "Name", width: 26 }, { key: "by", header: "Served by", width: 16 }, { key: "summary", header: "Summary", width: 36 },
      { key: "items", header: "Items given", width: 40 }, { key: "decision", header: "Decision", width: 13 }, { key: "followup", header: "Follow-up", width: 10 },
      { key: "category", header: "Category (counselling)", width: 20 }, { key: "risk", header: "Risk", width: 10 }, { key: "referred", header: "Referred", width: 10 }, { key: "tests", header: "Tests", width: 24 },
    ],
    rows: records.map((r) => {
      const v = visitById.get(r.visit_id);
      const d = (r.data ?? {}) as Record<string, unknown>;
      const followup = d.wants_followup ?? d.followup_needed;
      return {
        served_at: lagos(r.served_at), station: stationById.get(r.station_id)?.name, card: v?.card_code, name: v ? benById.get(v.beneficiary_id)?.full_name : "",
        by: r.served_by_name, summary: r.summary, items: itemsText(d, itemName), decision: d.decision ?? "", followup: followup === undefined ? "" : followup ? "Yes" : "No",
        category: d.category ?? "", risk: d.risk ?? "", referred: d.referred === undefined ? "" : d.referred ? "Yes" : "No", tests: Array.isArray(d.tests) ? d.tests.join(", ") : "",
      };
    }),
  };
}
