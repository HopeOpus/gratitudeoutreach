"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Link2, FileDown, Plus, Eye, EyeOff, Copy, MessageCircle } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock, ReadOnlyNotice } from "@/components/admin/ui";
import { StationIcon } from "@/components/station/bits";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/utils";
import { isConfidentialKind, STATION_META, type StationKind } from "@/lib/stations";

type Pins = Record<string, { join: string | null; role: string | null; lead: string | null }>;

export default function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { editions } = useEditionCtx();
  const edition = editions.find((e) => e.id === id);
  const [show, setShow] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [link, setLink] = useState<{ station: string; url: string } | null>(null);

  const stations = useQuery({
    queryKey: ["stations", id],
    queryFn: async () => {
      const { data, error } = await adminClient().from("stations_public").select("*").eq("edition_id", id).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const pins = useQuery({
    queryKey: ["pins", id],
    queryFn: async () => {
      const r = await fetch(`/api/stations/pins?edition=${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Could not load PINs");
      return (await r.json()).pins as Pins;
    },
  });

  const rotate = async (stationId: string, which: "join" | "role" | "lead") => {
    const r = await fetch("/api/stations/pins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ station_id: stationId, [which]: "random" }) });
    const b = await r.json();
    if (!r.ok) { toast.error(b.error ?? "Could not rotate"); return; }
    toast.saved(`New ${which} PIN: ${b[which]}`);
    void pins.refetch();
  };
  const update = async (stationId: string, patch: { name?: string; enabled?: boolean }) => {
    const { error } = await adminClient().from("stations").update(patch).eq("id", stationId);
    if (error) toast.error(errorMessage(error)); else void stations.refetch();
  };
  const joinLink = async (stationId: string, name: string) => {
    const r = await fetch("/api/join-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ station_id: stationId, days: 3 }) });
    const b = await r.json();
    if (!r.ok) { toast.error(b.error ?? "Could not create link"); return; }
    setLink({ station: name, url: b.url });
  };

  if (!edition) return <LoadingBlock />;
  const closed = edition.status === "closed";
  return (
    <div>
      <PageHeader title="Stations and PINs" sub={edition.name}
        actions={<>
          <Button variant="secondary" onClick={() => setShow(!show)}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{show ? "Hide PINs" : "Show PINs"}</Button>
          <Button variant="secondary" asChild><a href={`/api/posters/pdf?edition=${id}`} target="_blank" rel="noopener"><FileDown className="size-4" /> Station posters (PDF)</a></Button>
          <Button onClick={() => setAddOpen(true)} disabled={closed}><Plus className="size-4" /> Add station</Button>
        </>} />
      <ReadOnlyNotice closed={closed} />
      <p className="mb-4 text-body text-neutral-700">Volunteers join with the <b>station PIN</b>. Medical and Counselling also need the <b>role PIN</b> (give it only to the Station Lead). The <b>lead PIN</b> makes someone a Station Lead and approves overrides.</p>
      {stations.isLoading ? <LoadingBlock /> : stations.error ? <ErrorBlock error={stations.error} /> : (
        <Table head={["Station", "Enabled", "Station PIN", "Role PIN", "Lead PIN", ""]}>
          {stations.data!.map((s) => {
            const p = pins.data?.[s.id!];
            const pinCell = (v: string | null | undefined, which: "join" | "role" | "lead", applicable = true) => !applicable ? <span className="text-caption text-neutral-500">Not needed</span> : (
              <div className="flex items-center gap-1">
                <span className="min-w-20 font-medium tracking-wider tabular text-forest">{v ? (show ? v : "••••••") : <span className="text-caption text-neutral-500">hidden</span>}</span>
                <Button size="sm" variant="ghost" aria-label={`Rotate ${which} PIN for ${s.name}`} disabled={closed} onClick={() => void rotate(s.id!, which)}><RefreshCw className="size-4" /></Button>
              </div>
            );
            return (
              <tr key={s.id}>
                <Td>
                  <div className="flex items-center gap-2"><StationIcon kind={s.kind!} size="sm" />
                    <Input defaultValue={s.name ?? ""} aria-label="Station name" className="h-10 max-w-48 text-body" disabled={closed}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && void update(s.id!, { name: e.target.value.trim() })} />
                    {isConfidentialKind(s.kind) && <Badge className="bg-confidential-bg text-confidential">🔒</Badge>}
                  </div>
                </Td>
                <Td><input type="checkbox" className="size-5 accent-leaf" checked={!!s.enabled} disabled={closed} aria-label={`Enable ${s.name}`} onChange={(e) => void update(s.id!, { enabled: e.target.checked })} /></Td>
                <Td>{pinCell(p?.join, "join")}</Td>
                <Td>{pinCell(p?.role, "role", isConfidentialKind(s.kind))}</Td>
                <Td>{pinCell(p?.lead, "lead")}</Td>
                <Td className="text-right"><Button size="sm" variant="secondary" disabled={edition.status !== "live" && edition.status !== "draft"} onClick={() => void joinLink(s.id!, s.name!)}><Link2 className="size-4" /> Join link</Button></Td>
              </tr>
            );
          })}
        </Table>
      )}
      {edition.status === "draft" && <p className="mt-3 text-caption text-neutral-500">Volunteers can only join once the edition is set LIVE.</p>}
      <AddStationSheet open={addOpen} onClose={() => setAddOpen(false)} editionId={id} onAdded={() => { void stations.refetch(); void pins.refetch(); }} />
      <BottomSheet open={!!link} onOpenChange={(o) => !o && setLink(null)} title={`Join link · ${link?.station ?? ""}`} description="Valid for 3 days. Anyone with this link can join the station, so share it only with your volunteers.">
        <div className="flex flex-col gap-2">
          <Input readOnly value={link?.url ?? ""} onFocus={(e) => e.target.select()} aria-label="Join link" />
          <Button onClick={() => { void navigator.clipboard.writeText(link!.url); toast.info("Copied"); }}><Copy className="size-4" /> Copy link</Button>
          <Button variant="secondary" asChild><a href={`https://wa.me/?text=${encodeURIComponent(`Join ${link?.station} for Gratitude Outreach: ${link?.url}`)}`} target="_blank" rel="noopener"><MessageCircle className="size-4" /> Share on WhatsApp</a></Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function AddStationSheet({ open, onClose, editionId, onAdded }: { open: boolean; onClose: () => void; editionId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StationKind>("custom");
  const add = async () => {
    const { data, error } = await adminClient().rpc("add_station", { p_edition: editionId, p_kind: kind, p_name: name.trim(), p_icon: undefined });
    if (error) { toast.error(errorMessage(error)); return; }
    await fetch("/api/stations/pins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ station_id: data, join: "random", lead: "random", ...(isConfidentialKind(kind) ? { role: "random" } : {}) }) });
    toast.saved(`${name} added`);
    setName(""); onAdded(); onClose();
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Add station" description="Custom stations (e.g. Eye check, Haircut, Children's corner) record notes and referrals.">
      <div className="flex flex-col gap-3">
        <Field label="Name" htmlFor="st-name"><Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Type" htmlFor="st-kind">
          <Select id="st-kind" value={kind} onChange={(e) => setKind(e.target.value as StationKind)}>
            {(Object.keys(STATION_META) as StationKind[]).map((k) => <option key={k} value={k}>{STATION_META[k].label}</option>)}
          </Select>
        </Field>
        <Button size="lg" block disabled={name.trim().length < 2} onClick={() => void add()}>Add station</Button>
      </div>
    </BottomSheet>
  );
}
