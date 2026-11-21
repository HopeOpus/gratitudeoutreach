"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Toggle chip (multi-select). Always has a text label; selected state also shows a check icon (not colour alone). */
export function Chip({
  selected, onToggle, children, disabled, className, size = "md",
}: { selected?: boolean; onToggle?: () => void; children: React.ReactNode; disabled?: boolean; className?: string; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 text-label font-medium transition-colors duration-150 cursor-pointer",
        size === "lg" ? "min-h-12" : "min-h-11",
        selected ? "border-leaf bg-leaf-50 text-leaf-700" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-25",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {selected && <Check className="size-4" aria-hidden />}
      {children}
    </button>
  );
}

export function ChipGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}
