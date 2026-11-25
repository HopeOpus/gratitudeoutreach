"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LocalStation } from "@/lib/offline/db";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isPrivateKind } from "@/lib/stations";
import { cn } from "@/lib/utils";

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h3 className="text-label font-medium text-forest">{title}</h3>
      {children}
    </section>
  );
}

/** Collapsed "More" area with optional notes + refer-to-station (all forms, FR-6.7). */
export function MoreOptions({ notes, setNotes, refer, setRefer, stations, currentStationId, notesLabel = "Notes (optional)" }: {
  notes?: string; setNotes?: (v: string) => void; refer: string[]; setRefer: (v: string[]) => void;
  stations: LocalStation[]; currentStationId: string; notesLabel?: string;
}) {
  const [open, setOpen] = useState(refer.length > 0 || !!notes);
  const options = stations.filter((s) => s.is_service && s.enabled && !isPrivateKind(s.kind) && s.id !== currentStationId);
  return (
    <div className="rounded-lg border border-neutral-100 bg-white">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between px-4 text-label font-medium text-forest cursor-pointer">
        {setNotes ? "Notes and referral" : "Refer to another station"}
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 p-4">
          {setNotes && (
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-forest">{notesLabel}</span>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-forest">Refer to</span>
            <ChipGroup label="Refer to station">
              {options.map((s) => (
                <Chip key={s.id} selected={refer.includes(s.id)} onToggle={() => setRefer(refer.includes(s.id) ? refer.filter((x) => x !== s.id) : [...refer, s.id])}>{s.name}</Chip>
              ))}
            </ChipGroup>
          </div>
        </div>
      )}
    </div>
  );
}

export function SaveBar({ disabled, saving, label = "Save", hint }: { disabled?: boolean; saving: boolean; label?: string; hint?: string }) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-100 bg-white p-3 safe-bottom">
      {hint && <p className="mb-2 text-center text-caption text-neutral-500">{hint}</p>}
      <Button type="submit" size="lg" block disabled={disabled} loading={saving}>{label}</Button>
    </div>
  );
}

/** Enter in a text box must not save a half-filled form. */
export function blockEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
}

export function cleanData<T extends Record<string, unknown>>(d: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0 && k === "refer_to_station_ids")) continue;
    out[k] = v;
  }
  return out as T;
}
