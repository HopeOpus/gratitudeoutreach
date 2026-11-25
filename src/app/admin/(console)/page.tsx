"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, OctagonAlert, Smartphone, PackageX, Lock } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import type { DashboardStats } from "@/lib/dashboard";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, KpiTile, Table, Td, LoadingBlock, ErrorBlock, NeedsEdition } from "@/components/admin/ui";
import { BarList, CloseEditionSheet } from "@/components/admin/widgets";
import { LiveActivity, liveActivityKey } from "@/components/admin/live-activity";
import { StationIcon } from "@/components/station/bits";
import { Card, AlertBanner, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatTime, relativeMinutes } from "@/lib/utils";

const HourlyChart = dynamic(() => import("@/components/admin/charts").then((m) => m.HourlyChart), { ssr: false, loading: () => <Skeleton className="h-56" /> });

export default function DashboardPage() {
  return <NeedsEdition>{(edition) => <Dashboard editionId={edition.id} closed={edition.status === "closed"} live={edition.status === "live"} name={edition.name} />}</NeedsEdition>;
}

function Dashboard({ editionId, closed, live, name }: { editionId: string; closed: boolean; live: boolean; name: string }) {
  const { admin, refetch: refetchEditions } = useEditionCtx();
  const qc = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);
  const q = useQuery({
    queryKey: ["dashboard", editionId],
    queryFn: async () => {
      const { data, error } = await adminClient().rpc("dashboard_stats", { p_edition: editionId });
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
    refetchInterval: 5000,
  });

  // Realtime nudges (coordinators can read service records/visits); polling covers viewers.
  useEffect(() => {
    if (!atLeast(admin, "coordinator")) return;
    const sb = adminClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["dashboard", editionId] });
        void qc.invalidateQueries({ queryKey: liveActivityKey(editionId) });
      }, 400);
    };
    const ch = sb.channel(`dash:${editionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_records", filter: `edition_id=eq.${editionId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `edition_id=eq.${editionId}` }, bump)
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [admin, editionId, qc]);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error} />;
  const s = q.data!;
  const k = s.kpis;
  const staleDevices = s.devices.filter((d) => d.pending_ops > 0 && (!d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() > 10 * 60_000));
  const unsynced = s.devices.filter((d) => d.pending_ops > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={name} sub={<>Updated {formatTime(s.generated_at)} · {s.devices.length} devices signed in{unsynced.length ? <span className="text-warning"> · {unsynced.length} with unsynced records</span> : null}</>}
        actions={atLeast(admin, "coordinator") && live ? <Button variant="secondary" onClick={() => setCloseOpen(true)}><Lock className="size-4" /> Close edition</Button> : undefined} />
      {closed && <AlertBanner tone="info">This edition is closed. Reports are final.</AlertBanner>}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Registered" value={formatNumber(k.registered)} />
        <KpiTile label="Served (unique)" value={formatNumber(k.served_unique)} hint={k.registered ? `${Math.round((k.served_unique / k.registered) * 100)}% of registered` : undefined} />
        <KpiTile label="Services delivered" value={formatNumber(k.services)} />
        <KpiTile label="On site" value={formatNumber(k.on_site)} />
        <KpiTile label="Decisions" value={formatNumber(k.decisions)} hint={`${k.salvations} new convert · ${k.rededications} rededication`} />
        <KpiTile label="Medical referrals" value={formatNumber(k.referrals)} />
        <KpiTile label="Counselled" value={formatNumber(k.counselled)} hint={`${k.already_born_again} already born again`} />
        <KpiTile label="Received healing" value={formatNumber(k.healings)} />
        <KpiTile label="Holy Ghost baptism" value={formatNumber(k.hg_baptised_today)} hint={`new today · ${k.hg_baptised_before} already`} />
        <KpiTile label="Speak in tongues" value={formatNumber(k.tongues)} />
        <KpiTile label="Laboratory / Optician" value={`${formatNumber(k.lab_patients)} / ${formatNumber(k.optician_patients)}`} />
        <KpiTile label="Minor surgery" value={formatNumber(k.minor_surgery)} hint="needed or done" />
      </section>

      <section aria-label="Stations" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {s.stations.filter((st) => st.kind !== "registration" && st.enabled).map((st) => {
          const pct = st.stock_opening ? st.stock_remaining / st.stock_opening : null;
          return (
            <Card key={st.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2"><StationIcon kind={st.kind} size="sm" /><span className="text-h3 font-medium text-forest">{st.name}</span></div>
              <dl className="grid grid-cols-3 gap-1 text-center">
                <div><dt className="text-caption text-neutral-500">Served</dt><dd className="text-h2 font-light tabular text-forest">{st.served}</dd></div>
                <div><dt className="text-caption text-neutral-500">Pending</dt><dd className="text-h2 font-light tabular text-forest">{st.pending}</dd></div>
                <div><dt className="text-caption text-neutral-500">Avg</dt><dd className="text-h2 font-light tabular text-forest">{st.avg_service_seconds ? `${Math.max(1, Math.round(st.avg_service_seconds / 60))}m` : "—"}</dd></div>
              </dl>
              {pct !== null && (
                <div>
                  <div className="flex justify-between text-caption text-neutral-500"><span>Stock</span><span className="tabular">{formatNumber(st.stock_remaining)} / {formatNumber(st.stock_opening)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-50" role="meter" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${st.name} stock`}>
                    <div className={cn("h-full rounded-full", pct > 0.4 ? "bg-fresh" : pct > 0.15 ? "bg-warning" : "bg-danger")} style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
                  </div>
                </div>
              )}
              <p className="text-caption text-neutral-500">{st.active_volunteers} active volunteer{st.active_volunteers === 1 ? "" : "s"}</p>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {atLeast(admin, "coordinator") ? <LiveActivity editionId={editionId} stations={s.stations} /> : <HourlyCard hourly={s.hourly} />}
        <Card className="flex flex-col gap-2 p-4" aria-label="Alerts">
          <h2 className="text-h3 font-medium text-forest">Alerts</h2>
          {s.urgent_flags.map((f) => (
            <AlertBanner key={f.id} tone="danger"><OctagonAlert className="hidden" />{f.text} {f.card_code && <span className="tabular">· {f.card_code}</span>} <span className="text-caption">({formatTime(f.created_at)})</span></AlertBanner>
          ))}
          {s.low_stock.map((i) => (
            <AlertBanner key={i.id} tone="warning"><PackageX className="hidden" />{i.name} {i.remaining <= 0 ? "is out of stock" : `low (${i.remaining} left)`} · {i.station}</AlertBanner>
          ))}
          {staleDevices.map((d) => (
            <AlertBanner key={d.session_id} tone="warning"><Smartphone className="hidden" />Device &apos;{d.name}{d.device_label ? ` · ${d.device_label}` : ""}&apos; has {d.pending_ops} unsynced for {relativeMinutes(d.oldest_pending_at ?? d.last_seen_at)}</AlertBanner>
          ))}
          {s.data_quality.card_conflicts > 0 && <AlertBanner tone="warning"><AlertTriangle className="hidden" />{s.data_quality.card_conflicts} card conflict(s) to resolve</AlertBanner>}
          {!s.urgent_flags.length && !s.low_stock.length && !staleDevices.length && !s.data_quality.card_conflicts && <p className="text-body text-neutral-500">No alerts.</p>}
        </Card>
      </div>

      {atLeast(admin, "coordinator") && <HourlyCard hourly={s.hourly} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 text-h3 font-medium text-forest">Demographics</h2>
          <BarList data={["0-12", "13-17", "18-35", "36-59", "60+"].map((a) => ({ label: a.replace("-", "–"), value: s.demographics.age_range[a] ?? 0 }))} />
          <div className="mt-4"><BarList data={Object.entries(s.demographics.gender).map(([g, v]) => ({ label: g === "female" ? "Female" : g === "male" ? "Male" : "Not given", value: v }))} /></div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-h3 font-medium text-forest">Top communities</h2>
          <BarList data={s.demographics.communities.map((c) => ({ label: c.community, value: c.count }))} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-h3 font-medium text-forest">Follow-ups</h2>
          <BarList data={Object.entries(s.followups_by_status).map(([k2, v]) => ({ label: k2[0]!.toUpperCase() + k2.slice(1), value: v }))} />
          {atLeast(admin, "followup") && <Link href="/admin/follow-ups" className="mt-3 inline-block text-label font-medium text-leaf-700 underline">Open pipeline</Link>}
        </Card>
      </div>

      <section aria-label="Device sync health">
        <h2 className="mb-2 text-h3 font-medium text-forest">Volunteers and device sync</h2>
        <Table head={["Volunteer", "Station", "Records", "Unsynced", "Last seen"]} empty="No one is signed in right now.">
          {s.devices.map((d) => (
            <tr key={d.session_id}>
              <Td><span className="font-medium text-forest">{d.name}</span>{d.role === "station_lead" && <span className="ml-2 text-caption text-leaf-700">Lead</span>}<br /><span className="text-caption text-neutral-500">{d.device_label}</span></Td>
              <Td>{d.station}</Td>
              <Td className="tabular">{d.records}</Td>
              <Td className={cn("tabular", d.pending_ops > 0 && "text-warning")}>{d.pending_ops > 0 ? `${d.pending_ops} · ${relativeMinutes(d.oldest_pending_at)}` : "0"}</Td>
              <Td>{relativeMinutes(d.last_seen_at)}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <CloseEditionSheet open={closeOpen} onClose={() => setCloseOpen(false)} editionId={editionId} unsynced={unsynced.length}
        onClosed={() => { refetchEditions(); void q.refetch(); }} />
    </div>
  );
}

function HourlyCard({ hourly }: { hourly: DashboardStats["hourly"] }) {
  return <Card className="p-4">{hourly.length ? <HourlyChart hourly={hourly} /> : <p className="py-16 text-center text-body text-neutral-500">Charts appear once people start arriving.</p>}</Card>;
}
