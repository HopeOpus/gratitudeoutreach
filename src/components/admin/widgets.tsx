"use client";
import { useState } from "react";
import { adminClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { formatNumber, errorMessage } from "@/lib/utils";

export function BarList({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-body text-neutral-500">No data yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[96px_1fr_48px] items-center gap-2 text-body">
          <span className="truncate text-neutral-700">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-neutral-50"><span className="block h-full rounded-full bg-leaf" style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="text-right tabular">{formatNumber(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function CloseEditionSheet({ open, onClose, editionId, unsynced, onClosed }: { open: boolean; onClose: () => void; editionId: string; unsynced: number; onClosed: () => void }) {
  const [busy, setBusy] = useState(false);
  const close = async (force: boolean) => {
    setBusy(true);
    const { data, error } = await adminClient().rpc("close_edition", { p_edition: editionId, p_force: force });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    const r = data as { closed: boolean; unsynced_devices: number };
    if (!r.closed) { toast.error(`${r.unsynced_devices} devices still have unsynced records.`); return; }
    toast.saved("Edition closed. The summary report is ready.");
    onClose();
    onClosed();
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Close this edition?"
      description={unsynced > 0 ? `${unsynced} devices have unsynced records. Ask those volunteers to connect and tap “Sync now”, or close anyway.` : "All devices are synced. Closing makes the edition read-only and finalises the report."}>
      <div className="flex flex-col gap-2">
        {unsynced > 0 && <Button variant="secondary" size="lg" block onClick={onClose}>Wait for sync</Button>}
        <Button variant={unsynced > 0 ? "destructive" : "primary"} size="lg" block loading={busy} onClick={() => void close(unsynced > 0)}>{unsynced > 0 ? "Close anyway" : "Close edition"}</Button>
      </div>
    </BottomSheet>
  );
}
