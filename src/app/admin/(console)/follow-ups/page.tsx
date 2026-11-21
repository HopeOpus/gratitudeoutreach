"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, MessageCircle, ClipboardCheck, Lock } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, LoadingBlock, ErrorBlock, NeedsEdition, Table, Td } from "@/components/admin/ui";
import { Card, Badge, AlertBanner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Field } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { FOLLOWUP_STATUS_LABEL, FOLLOWUP_TYPE_LABEL } from "@/lib/dashboard";
import { formatDate, relativeMinutes, errorMessage, cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type F = Database["public"]["Functions"]["list_followups"]["Returns"][number];
const STATUSES = ["new", "assigned", "contacted", "completed", "unreachable"] as const;
const TYPE_TONE: Record<string, string> = { salvation: "bg-leaf-50 text-leaf-700", rededication: "bg-leaf-50 text-leaf-700", prayer: "bg-teal-50 text-teal-700", fellowship: "bg-teal-50 text-teal-700", counselling: "bg-confidential-bg text-confidential", counselling_urgent: "bg-danger-bg text-danger", medical_referral: "bg-danger-bg text-danger" };

export default function FollowUpsPage() {
  return <NeedsEdition>{(e) => <Pipeline editionId={e.id} />}</NeedsEdition>;
}

function Pipeline({ editionId }: { editionId: string }) {
  const { admin } = useEditionCtx();
  const [view, setView] = useState<"board" | "list">("board");
  const [type, setType] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [consentOnly, setConsentOnly] = useState(false);
  const [logging, setLogging] = useState<F | null>(null);

  const q = useQuery({
    queryKey: ["followups", editionId],
    queryFn: async () => {
      const { data, error } = await adminClient().rpc("list_followups", { p_edition: editionId });
      if (error) throw error;
      return data;
    },
  });
  const team = useQuery({
    queryKey: ["assignees", editionId],
    queryFn: async () => (await adminClient().rpc("list_assignees", { p_edition: editionId })).data ?? [],
  });
  const rows = useMemo(() => (q.data ?? []).filter((f) => (!type || f.type === type) && (!assignee || (assignee === "none" ? !f.assignee_user_id : f.assignee_user_id === assignee)) && (!consentOnly || f.consented)), [q.data, type, assignee, consentOnly]);

  const assign = async (f: F, userId: string) => {
    const { error } = await adminClient().rpc("assign_followup", { p_followup: f.id, p_user: (userId || null) as string });
    if (error) toast.error(errorMessage(error)); else void q.refetch();
  };

  if (!atLeast(admin, "followup")) return <AlertBanner tone="info">Follow-ups are for the follow-up team and coordinators.</AlertBanner>;
  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error} />;

  const Actions = ({ f }: { f: F }) => (
    <div className="flex flex-wrap gap-1">
      {f.phone ? (
        <>
          <Button size="sm" variant="secondary" asChild><a href={`tel:${f.phone}`} aria-label={`Call ${f.full_name}`}><Phone className="size-4" /> Call</a></Button>
          <Button size="sm" variant="secondary" asChild><a href={`https://wa.me/${f.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" aria-label={`WhatsApp ${f.full_name}`}><MessageCircle className="size-4" /> WhatsApp</a></Button>
        </>
      ) : <span className="inline-flex items-center gap-1 text-caption text-neutral-500"><Lock className="size-3.5" aria-hidden />{f.consented ? "No phone" : "No contact consent"}</span>}
      <Button size="sm" onClick={() => setLogging(f)}><ClipboardCheck className="size-4" /> Log</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Follow-ups" sub={`${q.data!.length} created automatically from salvations, prayer requests, counselling and medical referrals.`}
        actions={<Segmented label="View" value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} className="w-56" />} />
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-52"><option value="">All types</option>{Object.entries(FOLLOWUP_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-52"><option value="">Anyone</option><option value="none">Unassigned</option>{(team.data ?? []).map((t) => <option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}</Select>
        <ChipGroup label="Consent"><Chip selected={consentOnly} onToggle={() => setConsentOnly(!consentOnly)}>Has contact consent</Chip></ChipGroup>
      </div>

      {view === "board" ? (
        <div className="grid gap-3 overflow-x-auto lg:grid-cols-5">
          {STATUSES.map((s) => (
            <section key={s} className="flex min-w-64 flex-col gap-2 rounded-lg bg-neutral-50 p-2" aria-label={FOLLOWUP_STATUS_LABEL[s]}>
              <h2 className="px-2 py-1 text-label font-medium text-neutral-700">{FOLLOWUP_STATUS_LABEL[s]} <span className="tabular">({rows.filter((r) => r.status === s).length})</span></h2>
              {rows.filter((r) => r.status === s).map((f) => (
                <Card key={f.id} className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-1"><Badge className={TYPE_TONE[f.type]}>{FOLLOWUP_TYPE_LABEL[f.type]}</Badge>{f.due_on && <span className="text-caption text-neutral-500">due {formatDate(f.due_on)}</span>}</div>
                  <p className="text-body font-medium text-forest">{f.full_name}</p>
                  <p className="text-caption text-neutral-500">{f.community ?? "—"} · {f.card_code ?? "no card"}</p>
                  {f.last_outcome && <p className="text-caption text-neutral-700">Last: {f.last_outcome.replace("_", " ")} · {relativeMinutes(f.last_outcome_at)}</p>}
                  <Select aria-label="Assign to" value={f.assignee_user_id ?? ""} onChange={(e) => void assign(f, e.target.value)} className="h-10 text-label">
                    <option value="">Unassigned</option>{(team.data ?? []).map((t) => <option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}
                  </Select>
                  <Actions f={f} />
                </Card>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <Table head={["Person", "Type", "Status", "Assigned", "Last outcome", ""]} empty="No follow-ups match these filters.">
          {rows.map((f) => (
            <tr key={f.id}>
              <Td><span className="font-medium">{f.full_name}</span><br /><span className="text-caption text-neutral-500">{f.community ?? "—"} · {f.card_code}</span></Td>
              <Td><Badge className={TYPE_TONE[f.type]}>{FOLLOWUP_TYPE_LABEL[f.type]}</Badge></Td>
              <Td>{FOLLOWUP_STATUS_LABEL[f.status]}</Td>
              <Td>{f.assignee_name ?? <span className="text-neutral-500">—</span>}</Td>
              <Td className="text-caption">{f.last_outcome ? `${f.last_outcome.replace("_", " ")}${f.last_note ? `: ${f.last_note}` : ""}` : "—"}</Td>
              <Td><Actions f={f} /></Td>
            </tr>
          ))}
        </Table>
      )}
      <OutcomeSheet f={logging} onClose={() => setLogging(null)} onDone={() => void q.refetch()} />
    </div>
  );
}

function OutcomeSheet({ f, onClose, onDone }: { f: F | null; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"reached" | "no_answer" | "wrong_number" | "visited" | "note">("reached");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>("");
  const save = async () => {
    if (!f) return;
    const { error } = await adminClient().rpc("log_followup", { p_followup: f.id, p_outcome: outcome, p_note: note || undefined, p_status: (status || undefined) as never });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.saved(`Logged for ${f.full_name.split(" ")[0]}`);
    setNote(""); setStatus(""); onDone(); onClose();
  };
  return (
    <BottomSheet open={!!f} onOpenChange={(o) => !o && onClose()} title={`Log outcome · ${f?.full_name ?? ""}`}>
      <div className="flex flex-col gap-4">
        <ChipGroup label="Outcome">
          {([["reached", "Reached"], ["no_answer", "No answer"], ["wrong_number", "Wrong number"], ["visited", "Visited"], ["note", "Note only"]] as const).map(([v, l]) => (
            <Chip key={v} size="lg" selected={outcome === v} onToggle={() => setOutcome(v)}>{l}</Chip>
          ))}
        </ChipGroup>
        <Field label="Notes / next step" htmlFor="fu-note"><Textarea id="fu-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="Move to" htmlFor="fu-status" hint="Leave blank to update automatically">
          <Select id="fu-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Automatic</option>{STATUSES.map((s) => <option key={s} value={s}>{FOLLOWUP_STATUS_LABEL[s]}</option>)}</Select>
        </Field>
        <Button size="lg" block onClick={() => void save()} className={cn()}>Save</Button>
      </div>
    </BottomSheet>
  );
}
