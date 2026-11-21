"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Settings2, CreditCard, Package, Users, Play, Lock, Unlock, Archive } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast, type Edition } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock } from "@/components/admin/ui";
import { CloseEditionSheet } from "@/components/admin/widgets";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AlertBanner, Badge, Toggle } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { editionSchema } from "@/lib/schemas/join";
import { formatDate, errorMessage, cn } from "@/lib/utils";

export default function EditionsPage() {
  const { editions, loading, refetch, admin, setEditionId } = useEditionCtx();
  const [createOpen, setCreateOpen] = useState(false);
  const [closing, setClosing] = useState<Edition | null>(null);

  const setStatus = async (e: Edition, status: "live" | "draft" | "closed") => {
    const { error } = await adminClient().from("editions").update({ status }).eq("id", e.id);
    if (error) toast.error(errorMessage(error)); else { toast.saved(status === "live" ? `${e.name} is LIVE` : `${e.name} reopened`); refetch(); }
  };
  const archive = async (e: Edition) => {
    if (!window.confirm(`Archive ${e.name}? It will be hidden from lists (data is kept).`)) return;
    const { error } = await adminClient().from("editions").update({ archived_at: new Date().toISOString() }).eq("id", e.id);
    if (error) toast.error(errorMessage(error)); else refetch();
  };

  return (
    <div>
      <PageHeader title="Editions" sub="One edition per outreach day. Clone last year's setup to save time."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New edition</Button>} />
      {loading ? <LoadingBlock /> : (
        <Table head={["Edition", "Date", "Status", "Setup", ""]} empty="No editions yet.">
          {editions.map((e) => (
            <tr key={e.id}>
              <Td><span className="font-medium text-forest">{e.name}</span>{e.is_training && <Badge className="ml-2 bg-warning-bg text-warning">Training</Badge>}<br /><span className="text-caption text-neutral-500">{e.code_prefix} · {e.venue ?? "No venue"}</span></Td>
              <Td>{formatDate(e.starts_on)}</Td>
              <Td><Badge className={cn(e.status === "live" ? "bg-leaf-50 text-leaf-700" : e.status === "closed" ? "bg-neutral-50 text-neutral-700" : "bg-warning-bg text-warning")}>{e.status}</Badge></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button asChild size="sm" variant="ghost"><Link href={`/admin/editions/${e.id}/setup`} onClick={() => setEditionId(e.id)}><Settings2 className="size-4" />Stations</Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link href={`/admin/editions/${e.id}/cards`} onClick={() => setEditionId(e.id)}><CreditCard className="size-4" />Cards</Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link href={`/admin/editions/${e.id}/inventory`} onClick={() => setEditionId(e.id)}><Package className="size-4" />Inventory</Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link href={`/admin/editions/${e.id}/volunteers`} onClick={() => setEditionId(e.id)}><Users className="size-4" />Volunteers</Link></Button>
                </div>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  {e.status === "draft" && <Button size="sm" onClick={() => void setStatus(e, "live")}><Play className="size-4" />Set live</Button>}
                  {e.status === "live" && <Button size="sm" variant="secondary" onClick={() => setClosing(e)}><Lock className="size-4" />Close</Button>}
                  {e.status === "closed" && atLeast(admin, "super_admin") && <Button size="sm" variant="secondary" onClick={() => void setStatus(e, "live")}><Unlock className="size-4" />Reopen</Button>}
                  {e.status !== "live" && <Button size="sm" variant="ghost" aria-label={`Archive ${e.name}`} onClick={() => void archive(e)}><Archive className="size-4" /></Button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <CreateEditionSheet open={createOpen} onClose={() => setCreateOpen(false)} editions={editions} onCreated={(id) => { refetch(); setEditionId(id); }} />
      {closing && <CloseEditionSheet open onClose={() => setClosing(null)} editionId={closing.id} unsynced={0} onClosed={refetch} />}
    </div>
  );
}

function CreateEditionSheet({ open, onClose, editions, onCreated }: { open: boolean; onClose: () => void; editions: Edition[]; onCreated: (id: string) => void }) {
  const year = new Date().getFullYear() + 1;
  const [f, setF] = useState({ name: `Gratitude Outreach ${year}`, code_prefix: `GO${String(year).slice(2)}`, starts_on: "", ends_on: "", venue: "", clone_from: "", is_training: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = editionSchema.safeParse({ ...f, ends_on: f.ends_on || f.starts_on });
    if (!parsed.success) { setErr(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/editions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(body.error ?? "Could not create"); return; }
    toast.saved("Edition created with default stations and fresh PINs");
    onCreated(body.id);
    onClose();
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="New edition">
      <form onSubmit={submit} className="flex flex-col gap-3">
        {err && <AlertBanner tone="danger">{err}</AlertBanner>}
        <Field label="Name" htmlFor="ed-name" required><Input id="ed-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Card code prefix" htmlFor="ed-prefix" hint="Cards will look like GO26-0142"><Input id="ed-prefix" value={f.code_prefix} onChange={(e) => setF({ ...f, code_prefix: e.target.value.toUpperCase() })} maxLength={6} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="ed-start" required><Input id="ed-start" type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></Field>
          <Field label="Ends (if multi-day)" htmlFor="ed-end"><Input id="ed-end" type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></Field>
        </div>
        <Field label="Venue" htmlFor="ed-venue"><Input id="ed-venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
        <Field label="Copy setup from" htmlFor="ed-clone" hint="Copies stations and inventory items (not people)">
          <Select id="ed-clone" value={f.clone_from} onChange={(e) => setF({ ...f, clone_from: e.target.value })}>
            <option value="">Start fresh (default stations)</option>
            {editions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
        <Toggle label="Training edition" description="Excluded from reports. Shows a TRAINING ribbon." checked={f.is_training} onChange={(v) => setF({ ...f, is_training: v })} />
        <Button type="submit" size="lg" block loading={busy}>Create edition</Button>
      </form>
    </BottomSheet>
  );
}
