"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({
  value, onChange, min = 1, max = 99, label, className,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)} role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
        className="grid size-12 place-items-center rounded-md border border-neutral-100 bg-white text-forest disabled:opacity-40 cursor-pointer">
        <Minus className="size-5" />
      </button>
      <output aria-live="polite" className="min-w-10 text-center text-h3 font-medium tabular">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
        className="grid size-12 place-items-center rounded-md border border-neutral-100 bg-white text-forest disabled:opacity-40 cursor-pointer">
        <Plus className="size-5" />
      </button>
    </div>
  );
}
