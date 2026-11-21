"use client";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import type { DashboardStats } from "@/lib/dashboard";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, KpiTile, Table, Td, LoadingBlock, ErrorBlock, NeedsEdition } from "@/components/admin/ui";
import { Card, AlertBanner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatNumber, formatDate } from "@/lib/utils";

const DATASETS = [
  { key: "beneficiaries", label: "Beneficiaries", hint: "Phone only for people who agreed to follow-up" },
  { key: "visits", label: "Visits and needs", hint: "One row per person, with need status per station" },
  { key: "services", label: "Services (all stations)", hint: "Non-confidential fields only" },
  { key: "inventory", label: "Inventory used", hint: "Opening, used, remaining" },
  { key: "followups", label: "Follow-ups", hint: "Status, assignee, last outcome" },
];

export default function ReportsPage() {
  return <NeedsEdition>{(e) => <Reports editionId={e.id} name={e.name} closed={e.status === "closed"} training={e.is_training} />}</NeedsEdition>;
}

function Reports({ editionId, name, closed, training }: { editionId: string; name: string; closed: boolean; training: boolean }) {
  const { admin, editions } = useEditionCtx();
  const q = useQuery({
    queryKey: ["dashboard", editionId],
    queryFn: async () => {
      const { data, error } = await adminClient().rpc("dashboard_stats", { p_edition: editionId });
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
  });
  const yoy = useQuery({
    queryKey: ["yoy", editions.map((e) => e.id).join()],
    queryFn: async () => {
      const real = editions.filter((e) => !e.is_training);
      const out = [];
      for (const e of real) {
        const { data } = await adminClient().rpc("dashboard_stats", { p_edition: e.id });
        if (data) out.push({ e, k: (data as unknown as DashboardStats).kpis });
      }
      return out;
    },
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error} />;
  const k = q.data!.kpis;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" sub={name} actions={<Button asChild><a href={`/api/reports/summary?edition=${editionId}`} target="_blank" rel="noopener"><FileDown className="size-4" /> Summary report (PDF)</a></Button>} />
      {!closed && <AlertBanner tone="info">The edition is still open: these numbers are live. Close the edition to finalise.</AlertBanner>}
      {training && <AlertBanner tone="warning">Training edition: never share these numbers as real results.</AlertBanner>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Registered" value={formatNumber(k.registered)} />
        <KpiTile label="Served" value={formatNumber(k.served_unique)} />
        <KpiTile label="Services" value={formatNumber(k.services)} />
        <KpiTile label="Follow-ups" value={formatNumber(k.followups)} />
      </div>
      {atLeast(admin, "coordinator") ? (
        <section>
          <h2 className="mb-2 text-h3 font-medium text-forest">Exports</h2>
          <p className="mb-3 text-body text-neutral-700">Every export is recorded in the audit log. Confidential medical and counselling notes are never exported.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {DATASETS.map((d) => (
              <Card key={d.key} className="flex flex-col gap-3 p-4">
                <div><p className="text-body-lg font-medium text-forest">{d.label}</p><p className="text-caption text-neutral-500">{d.hint}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" asChild><a href={`/api/exports/${d.key}?edition=${editionId}&format=xlsx`}><FileSpreadsheet className="size-4" /> Excel</a></Button>
                  <Button size="sm" variant="ghost" asChild><a href={`/api/exports/${d.key}?edition=${editionId}&format=csv`}>CSV</a></Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : <AlertBanner tone="info">Exports are available to coordinators.</AlertBanner>}
      <section>
        <h2 className="mb-2 text-h3 font-medium text-forest">Year on year</h2>
        {yoy.isLoading ? <LoadingBlock /> : (
          <Table head={["Edition", "Date", "Registered", "Served", "Services", "Decisions", "Referrals"]}>
            {(yoy.data ?? []).map(({ e, k: kk }) => (
              <tr key={e.id}><Td className="font-medium">{e.name}</Td><Td>{formatDate(e.starts_on)}</Td><Td className="tabular">{formatNumber(kk.registered)}</Td><Td className="tabular">{formatNumber(kk.served_unique)}</Td><Td className="tabular">{formatNumber(kk.services)}</Td><Td className="tabular">{formatNumber(kk.decisions)}</Td><Td className="tabular">{formatNumber(kk.referrals)}</Td></tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
