"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalVisit, type LocalNeed, type LocalRecord, type LocalFlag, type LocalStation, type LocalInventory, type LocalConfidential } from "./db";
import type { VolunteerSession } from "./session";

export function useSession(): VolunteerSession | null | undefined {
  // undefined = still loading, null = no session
  return useLiveQuery(async () => ((await db().meta.get("session"))?.value as VolunteerSession | undefined) ?? null, []);
}

export function useStations(): LocalStation[] {
  return useLiveQuery(() => db().stations.orderBy("sort_order").toArray(), []) ?? [];
}

export function useVisit(visitId: string | null | undefined): LocalVisit | null | undefined {
  return useLiveQuery(async () => (visitId ? (await db().visits.get(visitId)) ?? null : null), [visitId]);
}

export function useVisitNeeds(visitId: string | null | undefined): LocalNeed[] {
  return useLiveQuery(() => (visitId ? db().needs.where("visit_id").equals(visitId).toArray() : []), [visitId]) ?? [];
}

export function useVisitRecords(visitId: string | null | undefined): LocalRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!visitId) return [];
    const rows = await db().records.where("visit_id").equals(visitId).toArray();
    return rows.filter((r) => !r.voided_at).sort((a, b) => b.served_at.localeCompare(a.served_at));
  }, [visitId]);
}

export function useVisitConfidential(visitId: string | null | undefined): LocalConfidential[] {
  return useLiveQuery(() => (visitId ? db().confidential.where("visit_id").equals(visitId).toArray() : []), [visitId]) ?? [];
}

export function useVisitFlags(visitId: string | null | undefined): LocalFlag[] {
  return useLiveQuery(async () => {
    if (!visitId) return [];
    const rows = await db().flags.where("visit_id").equals(visitId).toArray();
    return rows.filter((f) => !f.resolved_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [visitId]) ?? [];
}

export function useInventory(stationId: string | null | undefined): LocalInventory[] | undefined {
  return useLiveQuery(async () => {
    if (!stationId) return [];
    const rows = await db().inventory.where("station_id").equals(stationId).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [stationId]);
}

export type QueueRow = LocalVisit & { need: LocalNeed };

/** Pending list (FR-7.1): registered with this need or referred here, not yet served, sorted by registration time. */
export function usePending(stationId: string | null | undefined): QueueRow[] | undefined {
  return useLiveQuery(async () => {
    if (!stationId) return [];
    const d = db();
    const needs = await d.needs.where("station_id").equals(stationId).filter((n) => n.state === "pending" || n.state === "referred").toArray();
    const visits = await d.visits.bulkGet(needs.map((n) => n.visit_id));
    const rows: QueueRow[] = [];
    needs.forEach((n, i) => {
      const v = visits[i];
      if (v && !v.deleted && v.status === "active") rows.push({ ...v, need: n });
    });
    return rows.sort((a, b) => a.registered_at.localeCompare(b.registered_at));
  }, [stationId]);
}

export type RecentRow = LocalVisit & { record: LocalRecord };

/** Last 20 people served at this station (FR-4.4). */
export function useRecent(stationId: string | null | undefined, limit = 20): RecentRow[] | undefined {
  return useLiveQuery(async () => {
    if (!stationId) return [];
    const d = db();
    const recs = (await d.records.where("station_id").equals(stationId).toArray())
      .filter((r) => !r.voided_at)
      .sort((a, b) => b.served_at.localeCompare(a.served_at))
      .slice(0, limit);
    const visits = await d.visits.bulkGet(recs.map((r) => r.visit_id));
    return recs.flatMap((r, i) => (visits[i] ? [{ ...visits[i]!, record: r }] : []));
  }, [stationId, limit]);
}

export function useStationCounts(stationId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!stationId) return { pending: 0, served: 0, avgSeconds: null as number | null };
    const d = db();
    const pending = await d.needs.where("station_id").equals(stationId).filter((n) => n.state === "pending" || n.state === "referred").count();
    const recs = (await d.records.where("station_id").equals(stationId).toArray()).filter((r) => !r.voided_at);
    const served = new Set(recs.map((r) => r.visit_id)).size;
    const times = recs.map((r) => new Date(r.served_at).getTime()).sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => (t - times[i]!) / 1000).filter((g) => g >= 5 && g <= 1200);
    const avgSeconds = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
    return { pending, served, avgSeconds };
  }, [stationId]) ?? { pending: 0, served: 0, avgSeconds: null };
}

export function useVisitCount(): number | undefined {
  return useLiveQuery(() => db().visits.count(), []);
}

export async function findVisitByCode(code: string): Promise<LocalVisit | undefined> {
  return db().visits.where("card_code").equals(code).first();
}
