"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, { where: "route", digest: error.digest }); }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-25 p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gratitude-icon.svg" alt="" aria-hidden className="size-16 rounded-xl" />
      <h1 className="text-h2 font-medium text-forest">Something went wrong on this screen</h1>
      <p className="max-w-sm text-body text-neutral-700">Your saved records are safe on this phone. Try again, or go back to the station home.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => window.location.assign(window.location.pathname.startsWith("/admin") ? "/admin" : "/s")}>Go home</Button>
      </div>
    </main>
  );
}
