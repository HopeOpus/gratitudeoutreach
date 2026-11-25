"use client";
import { isMedicalKind } from "@/lib/stations";
import { spiritualLine } from "@/lib/spiritual";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, ShieldAlert } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/admin/ui";
import { Card, AlertBanner, Badge, ConfidentialBadge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Textarea, Field } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { ageLabel } from "@/components/station/bits";
import { formatDateTime, formatTime, errorMessage } from "@/lib/utils";

const NEED_LABEL: Record<string, string> = { pending: "waiting", referred: "referred, waiting", served: "done", declined: "not available" };

export default function BeneficiaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { admin, editions } = useEditionCtx();
  const [glass, setGlass] = useState<{ visit: string; kind: "medical" | "counselling" } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, { kind: string; payload: Record<string, unknown>; created_at: string }[]>>({});

  const q = useQuery({
    queryKey: ["beneficiary", id],
    queryFn: async () => {
      const sb = adminClient();
      const { data: b, error } = await sb.from("beneficiaries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!b) return null;
      const { data: visits } = await sb.from("visits").select("*").eq("beneficiary_id", id).order("registered_at", { ascending: false });
      const visitIds = (visits ?? []).map((v) => v.id);
      const { data: records } = visitIds.length ? await sb.from("service_records").select("id, visit_id, station_id, summary, served_by_name, served_at, has_confidential, voided_at").in("visit_id", visitIds).order("served_at") : { data: [] };
      const { data: needs } = visitIds.length ? await sb.from("visit_needs").select("visit_id, station_id, state").in("visit_id", visitIds) : { data: [] };
      const { data: spiritual } = visitIds.length ? await sb.from("confidential_records").select("service_record_id, visit_id, payload").eq("kind", "spiritual").in("visit_id", visitIds) : { data: [] };
      const { data: stations } = await sb.from("stations_public").select("id, name, kind").in("edition_id", (visits ?? []).map((v) => v.edition_id));
      return { b, visits: visits ?? [], records: records ?? [], needs: needs ?? [], spiritual: spiritual ?? [], stations: stations ?? [] };
    },
    refetchInterval: 10_000,
  });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error} />;
  if (!q.data) return <AlertBanner tone="info">Person not found (or merged into another record).</AlertBanner>;
  const { b, visits, records, needs, spiritual, stations } = q.data;
  const st = (sid: string) => stations.find((s) => s.id === sid);

  const loadConfidential = async (visitId: string) => {
    const { data, error } = await adminClient().rpc("get_confidential", { p_visit: visitId });
    if (error) { toast.error(errorMessage(error)); return; }
    setRevealed((r) => ({ ...r, [visitId]: (data ?? []) as never }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={b.full_name} sub={[b.gender, ageLabel(b.age_range), b.community, b.language].filter(Boolean).join(" · ")} />
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div><p className="text-caption text-neutral-500">Phone</p><p className="text-body">{b.phone ?? "Not given"}</p></div>
        <div><p className="text-caption text-neutral-500">Church member</p><p className="text-body">{b.church_member ?? "—"}</p></div>
        <div><p className="text-caption text-neutral-500">Guardian</p><p className="text-body">{b.guardian_name ?? "—"}</p></div>
      </Card>
      {visits.map((v) => {
        const ed = editions.find((e) => e.id === v.edition_id);
        const recs = records.filter((r) => r.visit_id === v.id);
        const hasMed = recs.some((r) => r.has_confidential && isMedicalKind(st(r.station_id)?.kind));
        const hasCouns = recs.some((r) => r.has_confidential && st(r.station_id)?.kind === "counselling");
        return (
          <Card key={v.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h3 font-medium text-forest">{ed?.name ?? "Edition"}</h2>
              <Badge className="bg-neutral-50 text-neutral-700">{v.card_code ?? "No card"}</Badge>
              {v.consent_followup_at ? <Badge className="bg-leaf-50 text-leaf-700">Follow-up consent</Badge> : <Badge className="bg-neutral-50 text-neutral-700">No follow-up consent</Badge>}
            </div>
            <p className="text-caption text-neutral-500">Registered {formatDateTime(v.registered_at)} by {v.registered_by_name ?? "—"} · consent v{v.consent_version}</p>
            {needs.some((n) => n.visit_id === v.id) && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Needs">
                <span className="text-caption text-neutral-500">Needs</span>
                {needs.filter((n) => n.visit_id === v.id).map((n) => (
                  <Badge key={n.station_id} className={n.state === "served" ? "bg-leaf-50 text-leaf-700" : n.state === "declined" ? "bg-neutral-50 text-neutral-500 line-through" : "bg-warning-bg text-warning"}>
                    {n.state === "served" ? <Check className="size-3.5" aria-hidden /> : null}{st(n.station_id)?.name ?? "Station"} · {NEED_LABEL[n.state] ?? n.state}
                  </Badge>
                ))}
              </div>
            )}
            <ol className="divide-y divide-neutral-50">
              {recs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-body">
                  <span className="w-14 text-caption text-neutral-500 tabular">{formatTime(r.served_at)}</span>
                  <span className="font-medium">{st(r.station_id)?.name}</span>
                  {r.has_confidential && <ConfidentialBadge />}
                  <span className={r.voided_at ? "text-neutral-500 line-through" : ""}>{r.summary}</span>
                  <span className="text-caption text-neutral-500">by {r.served_by_name}</span>
                </li>
              ))}
            </ol>
            {spiritual.filter((x) => recs.some((r) => r.id === x.service_record_id && !r.voided_at)).map((x) => (
              <p key={x.service_record_id} className="flex items-start gap-1 text-body text-ink"><Lock className="mt-1 size-4 shrink-0 text-confidential" aria-hidden /><span><span className="font-medium">Counselling: </span>{spiritualLine(x.payload as Record<string, unknown>)}</span></p>
            ))}
            {(hasMed || hasCouns) && atLeast(admin, "coordinator") && (
              <div className="rounded-md border border-confidential/20 bg-confidential-bg p-3">
                <p className="flex items-center gap-1 text-label font-medium text-confidential"><Lock className="size-4" aria-hidden /> Confidential notes are hidden from admins.</p>
                {revealed[v.id] ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {revealed[v.id]!.map((c, i) => <li key={i} className="rounded-sm bg-white p-2 text-caption"><b className="font-medium">{c.kind}</b> · <code className="break-all">{JSON.stringify(c.payload)}</code></li>)}
                    {revealed[v.id]!.length === 0 && <li className="text-caption">No access (grant expired?).</li>}
                  </ul>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasMed && <Button size="sm" variant="secondary" onClick={() => setGlass({ visit: v.id, kind: "medical" })}><ShieldAlert className="size-4" /> Break glass: medical</Button>}
                    {hasCouns && <Button size="sm" variant="secondary" onClick={() => setGlass({ visit: v.id, kind: "counselling" })}><ShieldAlert className="size-4" /> Break glass: counselling</Button>}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
      <BreakGlassSheet target={glass} onClose={() => setGlass(null)} onGranted={(visit) => void loadConfidential(visit)} />
    </div>
  );
}

function BreakGlassSheet({ target, onClose, onGranted }: { target: { visit: string; kind: "medical" | "counselling" } | null; onClose: () => void; onGranted: (visit: string) => void }) {
  const [reason, setReason] = useState("");
  const grant = async () => {
    if (!target) return;
    const { error } = await adminClient().rpc("break_glass", { p_kind: target.kind, p_visit: target.visit, p_reason: reason });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.info("Access granted for 1 hour. This is recorded in the audit log.");
    onGranted(target.visit); setReason(""); onClose();
  };
  return (
    <BottomSheet open={!!target} onOpenChange={(o) => !o && onClose()} title="Break glass" description={`You are about to read confidential ${target?.kind} notes. This is recorded with your name and reason, and access expires in 1 hour.`}>
      <Field label="Reason (required)" htmlFor="bg-reason" hint="e.g. Hospital requested referral details for a follow-up">
        <Textarea id="bg-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button variant="destructive" size="lg" block className="mt-4" disabled={reason.trim().length < 10} onClick={() => void grant()}>I understand, show notes</Button>
    </BottomSheet>
  );
}
