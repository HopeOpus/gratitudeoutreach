"use client";
import { cn } from "@/lib/utils";

export type SyncState = { status: "synced" | "offline" | "syncing" | "error"; pending: number };

/** Pill for the dark header (FR-13.4). Colour is always paired with text. */
export function SyncIndicator({ state, onClick, className }: { state: SyncState; onClick?: () => void; className?: string }) {
  const { status, pending } = state;
  const label =
    status === "synced" ? "Synced"
    : status === "syncing" ? "Syncing…"
    : status === "offline" ? `Offline${pending ? ` · ${pending} pending` : ""}`
    : `Sync error · tap`;
  const dot =
    status === "synced" ? "bg-fresh" : status === "syncing" ? "bg-teal animate-pulse" : status === "offline" ? "bg-warning-bg" : "bg-danger";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      aria-label={`Sync status: ${label}`}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-caption font-medium cursor-pointer",
        status === "error" ? "bg-danger text-white" : "bg-forest-950 text-white",
        className,
      )}
    >
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      {label}
    </button>
  );
}
