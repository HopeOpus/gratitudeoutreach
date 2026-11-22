"use client";
// Lazy-loaded (next/dynamic) so the camera code stays out of the main /s bundle.
import { useEffect, useRef, useState } from "react";
import { X, Keyboard, CameraOff } from "lucide-react";
import { parseCardPayload } from "@/lib/cards";
import { Button } from "@/components/ui/button";
import { vibrate } from "@/lib/utils";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }
}

export default function Scanner({ onCode, onClose, onTypeCode, title = "Scan card", accept = parseCardPayload, rejectHint = "That QR code is not from Gratitude Outreach." }: {
  onCode: (code: string) => void; onClose: () => void; onTypeCode: () => void; title?: string;
  accept?: (raw: string) => string | null; rejectHint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<"denied" | "unavailable" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const done = useRef(false);
  const cb = useRef({ onCode, accept, rejectHint });
  cb.current = { onCode, accept, rejectHint };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopZxing: (() => void) | null = null;
    let cancelled = false;

    const handle = (raw: string) => {
      if (done.current) return;
      const code = cb.current.accept(raw);
      if (!code) { setHint(cb.current.rejectHint); return; }
      done.current = true;
      vibrate(40);
      cb.current.onCode(code);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setError("unavailable"); return; }
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
          if (cancelled) return;
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const tick = async () => {
            if (cancelled || done.current) return;
            try {
              const found = await detector.detect(video);
              if (found[0]?.rawValue) handle(found[0].rawValue);
            } catch { /* frame not ready */ }
            raf = window.setTimeout(() => requestAnimationFrame(tick), 120) as unknown as number;
          };
          tick();
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" } }, videoRef.current!,
            (result) => { if (result) handle(result.getText()); },
          );
          stopZxing = () => controls.stop();
        }
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(raf);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-forest-950 text-white">
      <div className="flex h-14 items-center justify-between px-2">
        <Button variant="outlineDark" size="icon" aria-label="Close scanner" onClick={onClose} className="border-0"><X className="size-6" /></Button>
        <p className="text-body font-medium text-fresh">{title}</p>
        <span className="w-12" />
      </div>
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <CameraOff className="size-12 text-fresh" aria-hidden />
            <p className="text-h3 font-medium">{error === "denied" ? "Camera permission is off" : "Camera not available"}</p>
            <p className="text-body text-forest-100">
              {error === "denied" ? "Allow camera access in your browser settings, or type the card code instead." : "Type the card code instead."}
            </p>
            <Button variant="dark" size="lg" onClick={onTypeCode}><Keyboard className="size-5" /> Type card code</Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label="Camera view" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="size-64 rounded-xl border-4 border-fresh shadow-[0_0_0_9999px_rgba(4,20,8,0.55)]" />
            </div>
            <p className="absolute inset-x-0 bottom-6 text-center text-body text-white" aria-live="polite">{hint ?? "Point the camera at the QR on the card"}</p>
          </>
        )}
      </div>
      {!error && (
        <div className="p-4 safe-bottom">
          <Button variant="outlineDark" size="lg" block onClick={onTypeCode}><Keyboard className="size-5" /> Type card code</Button>
        </div>
      )}
    </div>
  );
}
