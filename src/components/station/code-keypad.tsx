"use client";
import { useState } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { codeFromDigits } from "@/lib/cards";
import { cn } from "@/lib/utils";

/** Numeric keypad with fixed prefix chip (FR-4.3). 72 px keys. */
export function CodeKeypad({ prefix, onSubmit, submitLabel = "Open" }: { prefix: string; onSubmit: (code: string) => void; submitLabel?: string }) {
  const [digits, setDigits] = useState("");
  const press = (k: string) => setDigits((d) => (d.length >= 5 ? d : d + k));
  const code = codeFromDigits(prefix, digits);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2 rounded-lg border border-neutral-100 bg-white py-4" aria-live="polite">
        <span className="rounded-sm bg-neutral-50 px-2 py-1 text-code font-medium tracking-wider text-neutral-700">{prefix}-</span>
        <span className={cn("min-w-24 text-code font-medium tracking-wider tabular", digits ? "text-forest" : "text-neutral-300")}>{digits || "0000"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className="h-18 rounded-md border border-neutral-100 bg-white text-h2 font-medium text-forest active:bg-neutral-50 cursor-pointer">{k}</button>
        ))}
        <button type="button" onClick={() => setDigits("")} className="h-18 rounded-md text-label font-medium text-neutral-700 cursor-pointer">Clear</button>
        <button type="button" onClick={() => press("0")} className="h-18 rounded-md border border-neutral-100 bg-white text-h2 font-medium text-forest active:bg-neutral-50 cursor-pointer">0</button>
        <button type="button" aria-label="Delete digit" onClick={() => setDigits((d) => d.slice(0, -1))} className="grid h-18 place-items-center rounded-md text-forest cursor-pointer"><Delete className="size-6" /></button>
      </div>
      <Button size="lg" block disabled={!code} onClick={() => code && onSubmit(code)}>{submitLabel} {code ?? ""}</Button>
    </div>
  );
}
