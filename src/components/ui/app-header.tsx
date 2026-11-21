import * as React from "react";
import { cn } from "@/lib/utils";

/** Mobile header: forest bg, transparent mark, station name in fresh (DesignSystem §6). */
export function AppHeader({ title, left, right, className }: { title: string; left?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-3 bg-forest px-4 text-white", className)}>
      {left ?? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/gratitude-mark-transparent.svg" alt="Gratitude Outreach" className="size-7" />
      )}
      <h1 className="flex-1 truncate text-body font-medium text-fresh">{title}</h1>
      {right}
    </header>
  );
}
