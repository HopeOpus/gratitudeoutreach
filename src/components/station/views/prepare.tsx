"use client";
import { useEffect, useRef, useState } from "react";
import type { VolunteerSession } from "@/lib/offline/session";
import { loadSnapshot } from "@/lib/offline/sync";
import { setMeta } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { formatNumber, errorMessage } from "@/lib/utils";

/** "Getting ready for offline": downloads the edition cache (FR-13.3). */
export function PrepareView({ session, onDone }: { session: VolunteerSession; onDone: () => void }) {
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = async () => {
    setError(null);
    try {
      await loadSnapshot(session.edition.id, (done, total) => setProgress({ done, total }));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 5;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-forest px-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-56" />
      <div className="w-full max-w-sm">
        <p className="text-h3 font-medium text-fresh">Getting ready for offline</p>
        <p className="mt-1 text-body text-forest-100">
          {progress.total ? `Saving ${formatNumber(progress.done)} of ${formatNumber(progress.total)} people for offline use` : "Connecting…"}
        </p>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-forest-950" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-fresh transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {error && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <p role="alert" className="text-body text-fresh-200">Could not download: {error}</p>
          <Button variant="dark" size="lg" block onClick={() => void run()}>Try again</Button>
        </div>
      )}
      {(progress.done > 0 || error) && (
        <Button variant="outlineDark" size="lg" onClick={async () => { await setMeta("snapshot_at", new Date().toISOString()); onDone(); }}>
          Skip for now
        </Button>
      )}
      <p className="text-caption text-forest-100">{session.station.name} · {session.edition.name}</p>
    </div>
  );
}
