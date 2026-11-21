import * as React from "react";
import { AlertTriangle, Info, OctagonAlert, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-neutral-50", className)} />;
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-neutral-100 bg-white shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex flex-col items-center gap-3 overflow-hidden rounded-lg px-6 py-10 text-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gratitude-icon.svg" alt="" aria-hidden className="size-14 rounded-xl opacity-90" />
      <p className="text-h3 font-medium text-forest">{title}</p>
      {body && <p className="max-w-sm text-body text-neutral-700">{body}</p>}
      {action}
    </div>
  );
}

const ALERT = {
  warning: { cls: "bg-warning-bg text-warning border-warning/30", Icon: AlertTriangle },
  danger: { cls: "bg-danger-bg text-danger border-danger/30", Icon: OctagonAlert },
  info: { cls: "bg-info-bg text-info border-info/30", Icon: Info },
  success: { cls: "bg-success-bg text-success border-success/30", Icon: CheckCircle2 },
  confidential: { cls: "bg-confidential-bg text-confidential border-confidential/30", Icon: Lock },
} as const;

export function AlertBanner({
  tone = "info", children, className, action,
}: { tone?: keyof typeof ALERT; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const { cls, Icon } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-md border px-4 py-3 text-body", cls, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function CodeBadge({ code, className, size = "md" }: { code: string | null | undefined; className?: string; size?: "md" | "lg" }) {
  if (!code) return <span className={cn("rounded-sm bg-neutral-50 px-2 py-0.5 text-caption text-neutral-500", className)}>No card</span>;
  return (
    <span className={cn("rounded-sm bg-neutral-50 px-2 py-0.5 font-medium tracking-wider tabular text-forest", size === "lg" ? "text-code" : "text-label", className)}>
      {code}
    </span>
  );
}

export function ConfidentialBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-confidential-bg px-2 py-0.5 text-caption font-medium text-confidential", className)}>
      <Lock className="size-3.5" aria-hidden /> Confidential
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-medium", className)}>{children}</span>;
}

export function Checkbox({
  checked, onChange, label, description, id, required,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-neutral-100 bg-white p-4">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required={required}
        className="mt-0.5 size-6 shrink-0 accent-leaf" />
      <span>
        <span className="block text-body-lg font-medium text-forest">{label}{required && <span className="text-danger"> *</span>}</span>
        {description && <span className="mt-0.5 block text-body text-neutral-700">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-md border border-neutral-100 bg-white px-4 py-3 text-left cursor-pointer">
      <span>
        <span className="block text-body-lg font-medium text-forest">{label}</span>
        {description && <span className="block text-caption text-neutral-500">{description}</span>}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-leaf" : "bg-neutral-300")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5.5" : "translate-x-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </span>
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-label="Loading" role="status" className={cn("inline-block size-5 animate-spin rounded-full border-2 border-neutral-100 border-t-leaf", className)} />;
}
