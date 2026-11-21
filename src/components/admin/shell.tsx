"use client";
import { useEffect, useState } from "react";
import { installGlobalErrorHandlers } from "@/lib/monitoring";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activity, CalendarDays, Users, HeartHandshake, FileBarChart, ScrollText, Settings, LogOut, Menu, X } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { EditionProvider, useEditionCtx, atLeast, type AdminInfo } from "./edition-context";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Live", icon: Activity, min: "viewer" as const },
  { href: "/admin/editions", label: "Editions", icon: CalendarDays, min: "coordinator" as const },
  { href: "/admin/beneficiaries", label: "People", icon: Users, min: "coordinator" as const },
  { href: "/admin/follow-ups", label: "Follow-ups", icon: HeartHandshake, min: "followup" as const },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart, min: "viewer" as const },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, min: "super_admin" as const },
  { href: "/admin/settings", label: "Settings", icon: Settings, min: "super_admin" as const },
];

export function AdminShell({ admin, children }: { admin: AdminInfo; children: React.ReactNode }) {
  useEffect(() => installGlobalErrorHandlers("admin"), []);
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <EditionProvider admin={admin}>
        <Frame>{children}</Frame>
        <Toaster />
      </EditionProvider>
    </QueryClientProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { admin, editions, edition, setEditionId } = useEditionCtx();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => atLeast(admin, n.min) && !(admin.role === "followup" && n.href === "/admin/beneficiaries"));
  const signOut = async () => { await adminClient().auth.signOut(); window.location.href = "/admin/login"; };

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path?.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
            className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-label font-medium", active ? "bg-forest-950 text-fresh" : "text-forest-100 hover:bg-forest-950/60")}>
            <n.icon className="size-5" strokeWidth={1.75} aria-hidden /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-neutral-25 md:grid md:grid-cols-[232px_1fr]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-6 bg-forest p-4 text-white transition-transform md:static md:w-auto md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-40" />
          <button className="grid size-11 place-items-center md:hidden cursor-pointer" aria-label="Close menu" onClick={() => setOpen(false)}><X className="size-5" /></button>
        </div>
        {nav}
        <div className="mt-auto flex flex-col gap-2 border-t border-forest-500/40 pt-4">
          <p className="text-caption text-forest-100">{admin.displayName}<br /><span className="text-forest-300">{admin.role.replace("_", " ")}</span></p>
          <button onClick={() => void signOut()} className="flex h-10 items-center gap-2 rounded-md px-2 text-label text-forest-100 hover:bg-forest-950 cursor-pointer"><LogOut className="size-4" /> Sign out</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-forest/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-100 bg-white px-4 md:px-8">
          <button className="grid size-11 place-items-center rounded-md md:hidden cursor-pointer" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
          <label htmlFor="edition-pick" className="sr-only">Edition</label>
          <select id="edition-pick" value={edition?.id ?? ""} onChange={(e) => setEditionId(e.target.value)}
            className="h-10 max-w-[60vw] rounded-md border border-neutral-100 bg-white px-3 text-label font-medium text-forest">
            {editions.map((e) => <option key={e.id} value={e.id}>{e.name}{e.is_training ? " (training)" : ""}</option>)}
          </select>
          {edition && (
            <span className={cn("rounded-full px-2.5 py-1 text-caption font-medium", edition.status === "live" ? "bg-leaf-50 text-leaf-700" : edition.status === "closed" ? "bg-neutral-50 text-neutral-700" : "bg-warning-bg text-warning")}>
              {edition.status === "live" ? "LIVE ●" : edition.status.toUpperCase()}
            </span>
          )}
        </header>
        {edition?.is_training && <div className="bg-warning-bg px-4 py-1.5 text-center text-caption font-medium text-warning">TRAINING EDITION: excluded from reports</div>}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
