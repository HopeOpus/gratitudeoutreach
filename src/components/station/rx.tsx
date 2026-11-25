"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pill, Trash2 } from "lucide-react";
import { db, type LocalConfidential, type LocalInventory, type LocalRecord, type LocalStation } from "@/lib/offline/db";
import type { RxLine } from "@/lib/quick-ticks";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { formatTime } from "@/lib/utils";

const DOSAGES = ["1 tab once daily", "1 tab twice daily", "1 tab three times daily", "2 tabs twice daily", "As directed"];

/** Medicines registered in the inventory of the Medical and Pharmacy stations. */
export function useDrugs(stations: LocalStation[]): LocalInventory[] | undefined {
  const ids = useMemo(() => stations.filter((s) => s.kind === "medical" || s.kind === "pharmacy").map((s) => s.id), [stations]);
  return useLiveQuery(async () => {
    if (!ids.length) return [];
    const rows = await db().inventory.where("station_id").anyOf(ids).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [ids.join(",")]);
}

/** Medical: pick medicines from the inventory, with quantity and dosage. */
export function PrescriptionEditor({ drugs, lines, onChange }: { drugs: LocalInventory[]; lines: RxLine[]; onChange: (l: RxLine[]) => void }) {
  const [q, setQ] = useState("");
  const chosen = new Set(lines.map((l) => l.item_id));
  const shown = drugs.filter((d) => !chosen.has(d.id) && (!q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 12);
  const update = (id: string, patch: Partial<RxLine>) => onChange(lines.map((l) => (l.item_id === id ? { ...l, ...patch } : l)));

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4">
      <p className="inline-flex items-center gap-1.5 text-label font-medium text-forest"><Pill className="size-4" aria-hidden /> Prescription (optional)</p>
      {lines.map((l) => (
        <div key={l.item_id} className="flex flex-col gap-2 rounded-md border border-neutral-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-lg font-medium text-forest">{l.name}</span>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${l.name}`} onClick={() => onChange(lines.filter((x) => x.item_id !== l.item_id))}><Trash2 className="size-5" /></Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-caption text-neutral-700">Quantity</span>
            <Stepper label={`${l.name} quantity`} value={l.qty} onChange={(v) => update(l.item_id, { qty: v })} max={100} />
          </div>
          <ChipGroup label={`${l.name} dosage`}>
            {DOSAGES.map((d) => <Chip key={d} selected={l.dosage === d} onToggle={() => update(l.item_id, { dosage: l.dosage === d ? undefined : d })}>{d}</Chip>)}
          </ChipGroup>
          <Input aria-label={`${l.name} dosage, other`} placeholder="Other dosage…" value={l.dosage && !DOSAGES.includes(l.dosage) ? l.dosage : ""}
            onChange={(e) => update(l.item_id, { dosage: e.target.value || undefined })} maxLength={120} />
        </div>
      ))}
      {drugs.length === 0 ? (
        <p className="text-caption text-neutral-500">No medicines in the inventory yet. Ask the coordinator to add them under General Doctor or Pharmacy.</p>
      ) : (
        <>
          <Input aria-label="Find a medicine" placeholder="Find a medicine…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ChipGroup label="Add a medicine">
            {shown.map((d) => (
              <Chip key={d.id} disabled={d.remaining <= 0} onToggle={() => { onChange([...lines, { item_id: d.id, name: d.name, qty: 1, dosage: undefined }]); setQ(""); }}>
                {d.remaining <= 0 ? `${d.name} (out)` : `+ ${d.name}`}
              </Chip>
            ))}
          </ChipGroup>
        </>
      )}
      {lines.length > 0 && <p className="text-caption text-neutral-700">Saving sends them to Pharmacy with this prescription.</p>}
    </div>
  );
}

export type PendingRx = { more: number; recordId: string; lines: RxLine[]; by: string | null; at: string };

/** Oldest prescription (doctor or optician) that no Pharmacy record has filled yet, and how many more wait. */
export function pendingPrescription(confidential: LocalConfidential[], records: LocalRecord[], pharmacyStationIds: Set<string>): PendingRx | null {
  const filled = new Set(records.filter((r) => pharmacyStationIds.has(r.station_id) && !r.voided_at).map((r) => String(r.data.prescription_id ?? "")));
  const byId = new Map(records.map((r) => [r.id, r]));
  const open = confidential
    .filter((c) => c.kind === "medical" && Array.isArray(c.payload.prescription) && (c.payload.prescription as unknown[]).length > 0)
    .filter((c) => !filled.has(c.service_record_id) && byId.has(c.service_record_id) && !byId.get(c.service_record_id)!.voided_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rx = open[0];
  if (!rx) return null;
  const rec = byId.get(rx.service_record_id);
  return { more: open.length - 1, recordId: rx.service_record_id, lines: rx.payload.prescription as RxLine[], by: rec?.served_by_name ?? null, at: rec?.served_at ?? rx.created_at };
}

/** Pharmacy: the prescription to fill. Ticked lines are dispensed (stock goes down). */
export function PrescriptionCard({ rx, stock, given, onToggle }: { rx: PendingRx; stock: Map<string, LocalInventory>; given: string[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-caption text-neutral-700">Prescribed{rx.by ? ` by ${rx.by}` : ""} at {formatTime(rx.at)}. Untick anything you could not give.</p>
      {rx.more > 0 && <p className="text-caption font-medium text-forest">{rx.more} more prescription{rx.more === 1 ? "" : "s"} after this one. Open this person again after saving.</p>}
      {rx.lines.map((l) => {
        const left = stock.get(l.item_id)?.remaining;
        const out = left !== undefined && left < l.qty;
        return (
          <Checkbox key={l.item_id} id={`rx-${l.item_id}`} checked={given.includes(l.item_id)} onChange={(on) => onToggle(l.item_id, on)}
            label={`${l.name} × ${l.qty}`}
            description={[l.dosage, out ? `Only ${Math.max(0, left ?? 0)} left in stock` : null].filter(Boolean).join(" · ") || undefined} />
        );
      })}
    </div>
  );
}
