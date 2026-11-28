"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPen } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { StationIcon } from "@/components/station/bits";
import { Card, Skeleton } from "@/components/ui/misc";
import { formatTime } from "@/lib/utils";

type Person = { id: string; full_name: string } | null;
type VisitRow = { id: string; card_code: string | null; registered_at: string; registered_by_name: string | null; beneficiary: Person };
type RecordRow = { id: string; station_id: string; summary: string; served_by_name: string; served_at: string; voided_at: string | null; visit: { card_code: string | null; beneficiary: Person } | null };
type Item = { key: string; at: string; person: Person; code: string | null; kind: string; title: string; detail: string; voided: boolean };

export const liveActivityKey = (editionId: string) => ["live-activity", editionId];

/**
 * Newest registrations and station ticks, merged into one feed. The dashboard
 * refetches it on every realtime change to visits / service_records.
 * Summaries never contain confidential content (DataModel §3).
 */
export function LiveActivity({ editionId, stations }: { editionId: string; stations: { id: string; name: string; kind: string }[] }) {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const q = useQuery({
    queryKey: liveActivityKey(editionId),
    queryFn: async () => {
      const sb = adminClient();
      const [v, r] = await Promise.all([
        sb.from("visits").select("id, card_code, registered_at, registered_by_name, beneficiary:beneficiaries(id, full_name)")
          .eq("edition_id", editionId).is("deleted_at", null).order("registered_at", { ascending: false }).limit(25),
        sb.from("service_records").select("id, station_id, summary, served_by_name, served_at, voided_at, visit:visits(card_code, beneficiary:beneficiaries(id, full_name))")
          .eq("edition_id", editionId).order("served_at", { ascending: false }).limit(25),
      ]);
      if (v.error) throw v.error;
      if (r.error) throw r.error;
      const items: Item[] = [
        ...(v.data as unknown as VisitRow[]).map((x) => ({
          key: `v:${x.id}`, at: x.registered_at, person: x.beneficiary, code: x.card_code, kind: "registration",
          title: "Registered", detail: x.registered_by_name ? `by ${x.registered_by_name}` : "", voided: false,
        })),
        ...(r.data as unknown as RecordRow[]).map((x) => ({
          key: `r:${x.id}`, at: x.served_at, person: x.visit?.beneficiary ?? null, code: x.visit?.card_code ?? null, kind: byId.get(x.station_id)?.kind ?? "custom",
          title: byId.get(x.station_id)?.name ?? "Station", detail: x.summary === byId.get(x.station_id)?.name ? `by ${x.served_by_name}` : `${x.summary} · by ${x.served_by_name}`, voided: !!x.voided_at,
        })),
      ];
      return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    },
    refetchInterval: 15_000,
  });

  return (
    <Card className="flex flex-col p-4" aria-labelledby="live-h">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="live-h" className="text-h3 font-medium text-forest">Live activity</h2>
        <span className="inline-flex items-center gap-1.5 text-caption text-neutral-500"><span className="size-2 rounded-full bg-leaf" aria-hidden /> Updates as it happens</span>
      </div>
      {q.isLoading ? <Skeleton className="h-64" /> : q.error ? (
        <p className="py-8 text-center text-body text-danger">Could not load activity. Retrying…</p>
      ) : !q.data?.length ? (
        <p className="py-12 text-center text-body text-neutral-500">Registrations and station ticks will appear here.</p>
      ) : (
        <ol aria-live="polite" className="max-h-[32rem] divide-y divide-neutral-50 overflow-y-auto">
          {q.data.map((it) => (
            <li key={it.key} className="flex items-start gap-3 py-2.5">
              {it.kind === "registration" ? <span className="grid size-8 shrink-0 place-items-center rounded-md bg-forest-50 text-st-registration"><ClipboardPen className="size-4" aria-hidden /></span> : <StationIcon kind={it.kind} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="text-body text-ink">
                  {it.person ? <Link href={`/admin/beneficiaries/${it.person.id}`} className="font-medium text-forest underline-offset-2 hover:underline">{it.person.full_name}</Link> : <span className="text-neutral-500">Unknown</span>}
                  {it.code && <span className="ml-2 text-caption text-neutral-500 tabular">{it.code}</span>}
                </p>
                <p className={it.voided ? "text-caption text-neutral-500 line-through" : "text-caption text-neutral-700"}>
                  <span className="font-medium">{it.title}</span>{it.detail ? ` · ${it.detail}` : ""}{it.voided ? " (undone)" : ""}
                </p>
              </div>
              <span className="shrink-0 text-caption text-neutral-500 tabular">{formatTime(it.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
