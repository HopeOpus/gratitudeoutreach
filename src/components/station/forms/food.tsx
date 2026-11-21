"use client";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useInventory } from "@/lib/offline/hooks";
import { foodDataSchema } from "@/lib/schemas/service";
import { foodSummary } from "@/lib/summary";
import { setNeed } from "@/lib/offline/mutations";
import { navigate } from "../nav";
import { peekOverride, takeOverride } from "../override";
import { Stepper } from "@/components/ui/stepper";
import { AlertBanner, Skeleton, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, Section, cleanData } from "./shared";

export function FoodForm({ visit, session, stations, saving, onSubmit }: FormProps) {
  const items = useInventory(session.station.id);
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [household, setHousehold] = useState(visit.household_size ?? 1);
  const [notes, setNotes] = useState("");
  const [refer, setRefer] = useState<string[]>([]);
  const hasOverride = !!peekOverride(visit.id);

  const names = useMemo(() => Object.fromEntries((items ?? []).map((i) => [i.id, i.name])), [items]);
  if (items === undefined) return <div className="p-4"><Skeleton className="h-48" /></div>;
  const allOut = items.length > 0 && items.every((i) => i.remaining <= 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    const data = cleanData({
      items: [{ item_id: itemId, qty }], household_served: household, notes: notes || undefined,
      refer_to_station_ids: refer, override_by: hasOverride ? takeOverride(visit.id) : undefined,
    });
    const parsed = foodDataSchema.parse(data);
    onSubmit({ summary: foodSummary(parsed, names), data: parsed });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        {hasOverride && <AlertBanner tone="success">Station Lead approved a second food collection.</AlertBanner>}
        {items.length === 0 && <AlertBanner tone="warning">No food items set up for this station. Ask the coordinator to add inventory.</AlertBanner>}
        {allOut && (
          <AlertBanner tone="warning" action={<Button size="sm" variant="secondary" onClick={async () => { await setNeed(visit, session.station.id, "declined", "Out of stock"); navigate("/s", { replace: true }); }}>Mark not available</Button>}>
            Everything is out of stock.
          </AlertBanner>
        )}
        <Section title="Pack type">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pack type">
            {items.map((i) => {
              const out = i.remaining <= 0;
              const low = !out && i.remaining <= i.low_threshold;
              const selected = itemId === i.id;
              return (
                <button key={i.id} type="button" role="radio" aria-checked={selected} disabled={out} onClick={() => setItemId(i.id)}
                  className={cn("relative flex min-h-24 flex-col items-start justify-between rounded-lg border-2 bg-white p-3 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    selected ? "border-leaf bg-leaf-50" : "border-neutral-100")}>
                  <span className="text-body-lg font-medium text-forest">{i.name}</span>
                  <span className={cn("text-caption tabular", out ? "text-neutral-500" : low ? "text-warning" : "text-neutral-500")}>
                    {out ? "Out of stock" : `${formatNumber(i.remaining)} left${low ? " · low" : ""}`}
                  </span>
                  {selected && <Check className="absolute right-2 top-2 size-6 text-leaf-600" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Section>
        <div className="flex flex-wrap items-end gap-6">
          <Section title="Quantity"><Stepper label="quantity" value={qty} onChange={setQty} max={10} /></Section>
          <Section title="Household size"><Stepper label="household size" value={household} onChange={setHousehold} max={30} /></Section>
        </div>
        {visit.household_size ? <Badge className="w-fit bg-neutral-50 text-neutral-700">Registered household: {visit.household_size}</Badge> : null}
        <MoreOptions notes={notes} setNotes={setNotes} refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} />
      </div>
      <SaveBar saving={saving} disabled={!itemId} label="Save" hint={!itemId ? "Tap a pack type" : undefined} />
    </form>
  );
}
