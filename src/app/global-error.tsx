"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, { where: "global", digest: error.digest }); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F7F9F7", color: "#272727", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ fontWeight: 500, color: "#07210D" }}>Something went wrong</h1>
          <p>Your saved records are safe on this phone.</p>
          <button onClick={reset} style={{ height: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#136F0E", color: "#fff", fontWeight: 500, fontSize: 16 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
