"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw, LogOut, AlertTriangle, Trash2, CloudUpload } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { db } from "@/lib/offline/db";
import { useSyncState } from "@/lib/offline/sync-state";
import { endSession, pushOutbox, pullDelta, retryFailed, discardOp, loadSnapshot } from "@/lib/offline/sync";
import { useVisitCount } from "@/lib/offline/hooks";
import { Button } from "@/components/ui/button";
import { Card, AlertBanner, Badge } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { formatTime, formatNumber, relativeMinutes } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export function SettingsView({ session }: { session: VolunteerSession }) {
  const sync = useSyncState();
  const people = useVisitCount();
  const ops = useLiveQuery(() => db().outbox.orderBy("seq").toArray(), []) ?? [];
  const failed = ops.filter((o) => o.status === "failed");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  const syncNow = async () => {
    setBusy(true);
    await pushOutbox();
    await pullDelta();
    setBusy(false);
    toast.info(sync.online ? "Sync finished" : "You're offline. We'll sync when the network is back.");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="p-4">
        <p className="text-caption text-neutral-500">Signed in as</p>
        <p className="text-h3 font-medium text-forest">{session.session.designation ? `${session.session.designation} ` : ""}{session.session.display_name}</p>
        <p className="text-body text-neutral-700">{session.station.name} · {session.edition.name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {session.session.role === "station_lead" && <Badge className="bg-leaf-50 text-leaf-700">Station Lead</Badge>}
          {session.edition.is_training && <Badge className="bg-warning-bg text-warning">Training mode</Badge>}
        </div>
        <p className="mt-2 text-caption text-neutral-500">Session ends at {formatTime(session.session.expires_at)}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-h3 font-medium text-forest">Sync</h2>
        <dl className="grid grid-cols-2 gap-2 text-body">
          <dt className="text-neutral-500">Status</dt><dd className="font-medium capitalize">{sync.status}</dd>
          <dt className="text-neutral-500">Waiting to send</dt><dd className="font-medium tabular">{sync.pending}</dd>
          <dt className="text-neutral-500">Needs attention</dt><dd className="font-medium tabular">{sync.failed}</dd>
          <dt className="text-neutral-500">Last sync</dt><dd className="font-medium">{relativeMinutes(sync.lastSyncAt)}</dd>
          <dt className="text-neutral-500">People on this phone</dt><dd className="font-medium tabular">{formatNumber(people ?? 0)}</dd>
        </dl>
        <Button size="lg" block loading={busy} onClick={() => void syncNow()}><CloudUpload className="size-5" /> Sync now</Button>
        <Button variant="secondary" size="lg" block onClick={async () => { setBusy(true); try { await loadSnapshot(session.edition.id); toast.info("Data refreshed"); } catch { toast.error("Could not refresh. Check the network."); } setBusy(false); }}>
          <RefreshCw className="size-5" /> Re-download people
        </Button>
      </Card>

      {failed.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <AlertBanner tone="danger">Some records could not be saved to the server. They are still on this phone.</AlertBanner>
          <ul className="flex flex-col gap-2">
            {failed.map((o) => (
              <li key={o.seq} className="flex items-start gap-3 rounded-md border border-neutral-100 p-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium">{o.label ?? (o.kind === "insert" ? o.table : o.fn)}</p>
                  <p className="text-caption text-neutral-500">{o.last_error}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Discard this record" onClick={() => void discardOp(o.seq!)}><Trash2 className="size-5" /></Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" block onClick={() => void retryFailed()}>Retry all</Button>
          <p className="text-caption text-neutral-500">If a record keeps failing, show this screen to your coordinator before discarding it.</p>
        </Card>
      )}

      <Button variant="destructive" size="lg" block onClick={() => setConfirmLeave(true)}><LogOut className="size-5" /> Leave station</Button>
      <BottomSheet open={confirmLeave} onOpenChange={setConfirmLeave} title="Leave this station?"
        description={sync.pending + sync.failed > 0 ? `${sync.pending + sync.failed} records have not reached the server yet. If you leave now they will be lost. Sync first.` : "All your records are saved. Data on this phone will be deleted."}>
        <div className="flex flex-col gap-2">
          {sync.pending + sync.failed > 0 ? (
            <>
              <Button size="lg" block onClick={() => { setConfirmLeave(false); void syncNow(); }}>Stay and sync first</Button>
              <Button variant="ghost" block className="text-danger" onClick={async () => {
                if (!window.confirm(`Delete ${sync.pending + sync.failed} unsynced records from this phone? This cannot be undone.`)) return;
                await endSession({ callServer: true }); window.location.replace("/join");
              }}>Leave anyway and lose them</Button>
            </>
          ) : (
            <>
              <Button variant="destructive" size="lg" block onClick={async () => { await endSession({ callServer: true }); window.location.replace("/join"); }}>
                Leave and clear this phone
              </Button>
              <Button variant="secondary" size="lg" block onClick={() => setConfirmLeave(false)}>Stay</Button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
