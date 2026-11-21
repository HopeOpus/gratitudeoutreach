"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, Skeleton, AlertBanner } from "@/components/ui/misc";
import { useEditionCtx } from "./edition-context";

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 font-medium text-forest">{title}</h1>
        {sub && <p className="mt-1 text-body text-neutral-700">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function KpiTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-caption text-neutral-500">{label}</span>
      <span className={cn("text-display font-light tabular", tone === "danger" ? "text-danger" : "text-forest")}>{value}</span>
      {hint && <span className="text-caption text-leaf-700">{hint}</span>}
    </Card>
  );
}

export function Table({ head, children, className, empty }: { head: React.ReactNode[]; children: React.ReactNode; className?: string; empty?: React.ReactNode }) {
  const hasRows = React.Children.count(children) > 0;
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-neutral-100 bg-white", className)}>
      <table className="w-full min-w-[640px] text-left text-body">
        <thead className="bg-neutral-50 text-label text-neutral-700">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">{children}</tbody>
      </table>
      {!hasRows && <div className="px-4 py-8 text-center text-body text-neutral-500">{empty ?? "Nothing here yet."}</div>}
    </div>
  );
}

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;

export function LoadingBlock() {
  return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
}

export function ErrorBlock({ error }: { error: unknown }) {
  const msg = (error as { message?: string })?.message ?? "Something went wrong";
  return <AlertBanner tone="danger">Could not load: {msg}. Check your connection and refresh.</AlertBanner>;
}

/** Wraps pages that need an edition; handles the empty and loading states. */
export function NeedsEdition({ children }: { children: (e: NonNullable<ReturnType<typeof useEditionCtx>["edition"]>) => React.ReactNode }) {
  const { edition, loading } = useEditionCtx();
  if (loading) return <LoadingBlock />;
  if (!edition) return <AlertBanner tone="info">No editions yet. Create one under Editions.</AlertBanner>;
  return <>{children(edition)}</>;
}

export function ReadOnlyNotice({ closed }: { closed: boolean }) {
  if (!closed) return null;
  return <AlertBanner tone="warning" className="mb-4">This edition is closed and read-only. A Super Admin can reopen it.</AlertBanner>;
}
