"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: string; tone?: "default" | "danger" };

/** Single-select segmented control (radio group semantics). */
export function Segmented<T extends string>({
  value, onChange, options, label, className,
}: { value: T | undefined; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-full gap-1 rounded-md bg-neutral-50 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 flex-1 rounded-sm px-2 text-label font-medium transition-colors duration-150 cursor-pointer",
              active
                ? o.tone === "danger" ? "bg-danger text-white shadow-sm" : "bg-white text-forest shadow-sm ring-1 ring-leaf"
                : "text-neutral-700 hover:bg-white/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
