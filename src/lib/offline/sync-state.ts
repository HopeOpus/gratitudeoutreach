"use client";
import { useSyncExternalStore } from "react";
import type { SyncState } from "@/components/ui/sync-indicator";

export interface SyncSnapshot extends SyncState {
  failed: number;
  online: boolean;
  busy: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  readOnly: boolean;
}

let state: SyncSnapshot = {
  status: "synced",
  pending: 0,
  failed: 0,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  busy: false,
  lastSyncAt: null,
  lastError: null,
  readOnly: false,
};
const listeners = new Set<() => void>();

function derive(s: SyncSnapshot): SyncState["status"] {
  if (s.failed > 0) return "error";
  if (!s.online) return "offline";
  if (s.busy || s.pending > 0) return "syncing";
  return "synced";
}

export function setSyncState(patch: Partial<Omit<SyncSnapshot, "status">>) {
  const next = { ...state, ...patch };
  next.status = derive(next);
  state = next;
  listeners.forEach((l) => l());
}

export function getSyncState() {
  return state;
}

export function useSyncState(): SyncSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
