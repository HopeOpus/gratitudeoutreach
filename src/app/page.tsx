import Link from "next/link";
import { ScanLine, LayoutDashboard } from "lucide-react";

export default function Landing() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 overflow-hidden bg-forest px-6 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gratitude-mark-transparent.svg" alt="" aria-hidden className="pointer-events-none absolute -right-24 -top-24 w-96 opacity-[0.06]" />
      <div className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-72" />
        <p className="max-w-sm text-body-lg text-forest-100">Register once. Every station sees what happened before. No paper collation afterwards.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href="/join" className="flex h-14 items-center justify-center gap-2 rounded-md bg-fresh text-body-lg font-medium text-forest hover:bg-fresh-400">
          <ScanLine className="size-5" /> Join a station
        </Link>
        <Link href="/admin" className="flex h-14 items-center justify-center gap-2 rounded-md border border-forest-500 text-body-lg font-medium text-white hover:bg-forest-950">
          <LayoutDashboard className="size-5" /> Admin sign in
        </Link>
      </div>
      <p className="text-caption text-forest-300">Gratitude Connect</p>
    </main>
  );
}
