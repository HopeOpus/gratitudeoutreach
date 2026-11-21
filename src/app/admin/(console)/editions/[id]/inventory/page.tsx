"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, PackagePlus, Trash2 } from "lucide-react";
import { uuidv7 } from "uuidv7";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock, ReadOnlyNotice } from "@/components/admin/ui";
import { StationIcon } from "@/components/station/bits";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { formatNumber, errorMessage, cn } from "@/lib/utils";

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { editions } = useEditionCtx();
  const edition = editions.find((e) => e.id === id);
  const [addOpen, setAddOpen] = useState(false);
  const [adjust, setAdjust] = useState<{ id: string; name: string } | null>(null);

  const stations = useQuery({
    queryKey: ["stations", id],
    queryFn: async () => (await adminClient().from("stations_public").select("*").eq("edition_id", id).order("sort_order")).data ?? [],
  });
  const items = useQuery({
    queryKey: ["inventory", id],
    queryFn: async () => {
      const { data, error } = await adminClient().from("inventory_items").select("*").eq("edition_id", id).order("name");
      if (error) throw error;
      return data;
    },
  });
  const update = async (itemId: string, patch: { opening_qty?: number; low_threshold?: number }) => {
    const { error } = await adminClient().from("inventory_items").update(patch).eq("id", itemId);
    if (error) toast.error(errorMessage(error)); else void items.refetch();
  };
  const remove = async (itemId: string, name: string) => {
    if (!window.confirm(`Delete ${name}? Only possible if nothing was given out yet.`)) return;
    const { error } = await adminClient().from("inventory_items").delete().eq("id", itemId);
    if (error) toast.error("This item has movements and can't be deleted. Set its stock to 0 instead."); else void items.refetch();
  };

  if (!edition) return <LoadingBlock />;
  const closed = edition.status === "closed";
  const stockStations = (stations.data ?? []).filter((s) => ["food", "clothing", "medical", "custom"].includes(s.kind!));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory" sub={`${edition.name} · stock goes down automatically as stations record services.`}
        actions={<Button onClick={() => setAddOpen(true)} disabled={closed}><Plus className="size-4" /> Add item</Button>} />
      <ReadOnlyNotice closed={closed} />
      {items.isLoading ? <LoadingBlock /> : items.error ? <ErrorBlock error={items.error} /> : stockStations.map((st) => {
        const rows = (items.data ?? []).filter((i) => i.station_id === st.id);
        return (
          <section key={st.id}>
            <h2 className="mb-2 flex items-center gap-2 text-h3 font-medium text-forest"><StationIcon kind={st.kind!} size="sm" />{st.name} <span className="text-caption font-normal text-neutral-500">({rows.length} items)</span></h2>
            <Table head={["Item", "Opening", "Remaining", "Low alert at", ""]} empty="No items yet.">
              {rows.map((i) => (
                <tr key={i.id}>
                  <Td><span className="font-medium">{i.name}</span><br /><span className="text-caption text-neutral-500">{i.unit}{i.sizes?.length ? ` · sizes ${i.sizes.join(", ")}` : ""}</span></Td>
                  <Td><Input type="number" min={0} defaultValue={i.opening_qty} disabled={closed} aria-label={`Opening quantity for ${i.name}`} className="h-10 w-24 text-body tabular"
                    onBlur={(e) => Number(e.target.value) !== i.opening_qty && void update(i.id, { opening_qty: Number(e.target.value) })} /></Td>
                  <Td><Badge className={cn("tabular", i.remaining <= 0 ? "bg-danger-bg text-danger" : i.remaining <= i.low_threshold ? "bg-warning-bg text-warning" : "bg-leaf-50 text-leaf-700")}>{formatNumber(i.remaining)}{i.remaining <= 0 ? " · out" : i.remaining <= i.low_threshold ? " · low" : ""}</Badge></Td>
                  <Td><Input type="number" min={0} defaultValue={i.low_threshold} disabled={closed} aria-label={`Low threshold for ${i.name}`} className="h-10 w-20 text-body tabular"
                    onBlur={(e) => Number(e.target.value) !== i.low_threshold && void update(i.id, { low_threshold: Number(e.target.value) })} /></Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" disabled={closed} onClick={() => setAdjust({ id: i.id, name: i.name })}><PackagePlus className="size-4" /> Adjust</Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${i.name}`} disabled={closed} onClick={() => void remove(i.id, i.name)}><Trash2 className="size-4" /></Button>
                  </Td>
                </tr>
              ))}
            </Table>
          </section>
        );
      })}
      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} editionId={id} stations={stockStations as { id: string; name: string }[]} onAdded={() => void items.refetch()} />
      <AdjustSheet item={adjust} onClose={() => setAdjust(null)} onDone={() => void items.refetch()} />
    </div>
  );
}

function AddItemSheet({ open, onClose, editionId, stations, onAdded }: { open: boolean; onClose: () => void; editionId: string; stations: { id: string; name: string }[]; onAdded: () => void }) {
  const [f, setF] = useState({ station_id: "", name: "", unit: "pcs", opening_qty: 0, low_threshold: 20, sizes: "" });
  const add = async () => {
    const { error } = await adminClient().from("inventory_items").insert({
      edition_id: editionId, station_id: f.station_id || stations[0]!.id, name: f.name.trim(), unit: f.unit, opening_qty: f.opening_qty, low_threshold: f.low_threshold,
      sizes: f.sizes.trim() ? f.sizes.split(",").map((s) => s.trim()).filter(Boolean) : null,
    });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.saved(`${f.name} added`);
    setF({ ...f, name: "", opening_qty: 0, sizes: "" });
    onAdded();
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Add inventory item">
      <div className="flex flex-col gap-3">
        <Field label="Station" htmlFor="it-st"><Select id="it-st" value={f.station_id} onChange={(e) => setF({ ...f, station_id: e.target.value })}>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Item name" htmlFor="it-name" hint="e.g. Family food pack, Paracetamol 500mg (strip), Children shirt"><Input id="it-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Unit" htmlFor="it-unit"><Input id="it-unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label="Opening qty" htmlFor="it-q"><Input id="it-q" type="number" min={0} value={f.opening_qty} onChange={(e) => setF({ ...f, opening_qty: Number(e.target.value) })} /></Field>
          <Field label="Low alert at" htmlFor="it-low"><Input id="it-low" type="number" min={0} value={f.low_threshold} onChange={(e) => setF({ ...f, low_threshold: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Sizes (clothing, comma-separated)" htmlFor="it-sizes"><Input id="it-sizes" value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} placeholder="S, M, L, XL" /></Field>
        <Button size="lg" block disabled={f.name.trim().length < 2} onClick={() => void add()}>Add item</Button>
      </div>
    </BottomSheet>
  );
}

function AdjustSheet({ item, onClose, onDone }: { item: { id: string; name: string } | null; onClose: () => void; onDone: () => void }) {
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState<"restock" | "damage" | "correction">("restock");
  const save = async () => {
    if (!item) return;
    const signed = reason === "damage" ? -Math.abs(delta) : reason === "restock" ? Math.abs(delta) : delta;
    const { error } = await adminClient().rpc("adjust_inventory", { p_id: uuidv7(), p_item: item.id, p_delta: signed, p_reason: reason });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.saved(`${item.name}: ${signed > 0 ? "+" : ""}${signed} (${reason})`);
    onDone(); onClose();
  };
  return (
    <BottomSheet open={!!item} onOpenChange={(o) => !o && onClose()} title={`Adjust ${item?.name ?? ""}`} description="Adjustments are logged.">
      <div className="flex flex-col gap-3">
        <Field label="Reason" htmlFor="adj-r"><Select id="adj-r" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}><option value="restock">Restock (+)</option><option value="damage">Damaged / lost (−)</option><option value="correction">Correction (±)</option></Select></Field>
        <Field label="Quantity" htmlFor="adj-q" hint={reason === "correction" ? "Use a negative number to reduce" : undefined}><Input id="adj-q" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></Field>
        <Button size="lg" block disabled={!delta} onClick={() => void save()}>Save adjustment</Button>
      </div>
    </BottomSheet>
  );
}
