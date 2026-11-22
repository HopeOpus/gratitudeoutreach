"use client";
import { useEffect, useState } from "react";
import { qrPayload } from "@/lib/cards";
import { cn } from "@/lib/utils";

/**
 * QR for a person's code, generated on the phone (works offline).
 * The payload is only the code (`GC:GO26-R1-042`), never personal data.
 */
export function QrImage({ code, className, label }: { code: string; className?: string; label?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode").then((QR) => QR.toString(qrPayload(code), { type: "svg", margin: 1, errorCorrectionLevel: "M" })).then((s) => { if (live) setSvg(s); });
    return () => { live = false; };
  }, [code]);
  return (
    <div role="img" aria-label={label ?? `QR code for ${code}`} className={cn("aspect-square bg-white [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
  );
}

/**
 * The slip printed at registration. Hidden on screen; `printSlip()` prints
 * only this element (see `.qr-slip` in globals.css). Sized for a 58 mm
 * receipt printer, and prints top-left on A4/Letter for cutting out.
 */
export function QrSlip({ code, firstName, eventName }: { code: string; firstName: string; eventName: string }) {
  return (
    <div id="qr-slip" className="qr-slip flex-col items-center gap-[2mm] bg-white text-center text-ink" aria-hidden>
      <p className="text-caption">{eventName}</p>
      <QrImage code={code} className="w-[44mm]" />
      <p className="text-h2 font-medium tracking-wider tabular">{code}</p>
      <p className="text-body-lg">{firstName}</p>
      <p className="text-caption">Show this at every stand</p>
    </div>
  );
}

export function printSlip() {
  const root = document.documentElement;
  root.classList.add("printing-slip");
  const done = () => { root.classList.remove("printing-slip"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
  // Some mobile browsers never fire afterprint.
  setTimeout(done, 60_000);
}
