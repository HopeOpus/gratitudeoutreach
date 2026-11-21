"use client";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { useInventory } from "@/lib/offline/hooks";
import { clothingDataSchema, type ClothingData } from "@/lib/schemas/service";
import { clothingSummary } from "@/lib/summary";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Stepper } from "@/components/ui/stepper";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { AlertBanner, Skeleton, Card } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, Section, cleanData } from "./shared";

type Line = { item_id: string; size?: string; qty: number };

export function ClothingForm({ session, stations, saving, onSubmit }: FormProps) {
  const items = useInventory(session.station.id);
  const [current, setCurrent] = useState<string | null>(null);
  const [size, setSize] = useState<string | undefined>();
  const [qty, setQty] = useState(1);
  const [basket, setBasket] = useState<Line[]>([]);
  const [forWho, setForWho] = useState<ClothingData["for"]>("self");
  const [notes, setNotes] = useState("");
  const [refer, setRefer] = useState<string[]>([]);

  if (items === undefined) return <div className="p-4"><Skeleton className="h-48" /></div>;
  const item = items.find((i) => i.id === current);
  const inBasket = (id: string) => basket.filter((l) => l.item_id === id).reduce((n, l) => n + l.qty, 0);
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? "Item";

  const addLine = () => {
    if (!item) return;
    setBasket((b) => [...b, { item_id: item.id, size, qty }]);
    setCurrent(null); setSize(undefined); setQty(1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = item ? [...basket, { item_id: item.id, size, qty }] : basket;
    if (!lines.length) return;
    const parsed = clothingDataSchema.parse(cleanData({ items: lines, for: forWho, notes: notes || undefined, refer_to_station_ids: refer }));
    onSubmit({ summary: clothingSummary(parsed), data: parsed });
  };

  const total = basket.reduce((n, l) => n + l.qty, 0) + (item ? qty : 0);
  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        {items.length === 0 && <AlertBanner tone="warning">No clothing items set up. Ask the coordinator to add inventory.</AlertBanner>}
        <Section title="Category">
          <div className="grid grid-cols-2 gap-2">
            {items.map((i) => {
              const left = i.remaining - inBasket(i.id);
              return (
                <button key={i.id} type="button" aria-pressed={current === i.id} disabled={left <= 0} onClick={() => { setCurrent(i.id); setSize(undefined); setQty(1); }}
                  className={cn("flex min-h-18 flex-col items-start justify-between rounded-lg border-2 bg-white p-3 text-left cursor-pointer disabled:opacity-50",
                    current === i.id ? "border-leaf bg-leaf-50" : "border-neutral-100")}>
                  <span className="text-body font-medium text-forest">{i.name}</span>
                  <span className="text-caption text-neutral-500 tabular">{left <= 0 ? "Out of stock" : `${formatNumber(left)} left`}</span>
                </button>
              );
            })}
          </div>
        </Section>
        {item && (
          <Card className="flex flex-col gap-4 p-4">
            <p className="text-body-lg font-medium text-forest">{item.name}</p>
            {item.sizes?.length ? (
              <Section title="Size">
                <ChipGroup label="Size">{item.sizes.map((s) => <Chip key={s} selected={size === s} onToggle={() => setSize(s)}>{s}</Chip>)}</ChipGroup>
              </Section>
            ) : null}
            <div className="flex items-end justify-between gap-4">
              <Section title="Quantity"><Stepper label="quantity" value={qty} onChange={setQty} max={Math.max(1, Math.min(10, item.remaining - inBasket(item.id)))} /></Section>
              <Button type="button" variant="secondary" onClick={addLine} disabled={!!item.sizes?.length && !size}><Plus className="size-5" /> Add another</Button>
            </div>
          </Card>
        )}
        {basket.length > 0 && (
          <Section title={`Basket (${basket.reduce((n, l) => n + l.qty, 0)})`}>
            <ul className="divide-y divide-neutral-50 rounded-lg border border-neutral-100 bg-white">
              {basket.map((l, idx) => (
                <li key={idx} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-body">{name(l.item_id)}{l.size ? ` · ${l.size}` : ""} <span className="text-neutral-500">×{l.qty}</span></span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setBasket((b) => b.filter((_, i) => i !== idx))}><Trash2 className="size-5" /></Button>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="For">
          <Segmented label="For" value={forWho} onChange={setForWho} options={[{ value: "self", label: "Self" }, { value: "child", label: "Child" }, { value: "other", label: "Other" }]} />
        </Section>
        <MoreOptions notes={notes} setNotes={setNotes} refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} />
      </div>
      <SaveBar saving={saving} disabled={total === 0 || (!!item?.sizes?.length && !size && basket.length === 0)} label={total ? `Save ${total} ${total === 1 ? "item" : "items"}` : "Save"} />
    </form>
  );
}
