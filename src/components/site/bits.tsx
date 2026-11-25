import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { Photo } from "@/lib/site";
import { cn } from "@/lib/utils";

export const wrap = "mx-auto w-full max-w-6xl px-5 md:px-8";

/** Pill button with a separate round arrow. */
export function PillLink({ href, children, tone = "dark" }: { href: string; children: React.ReactNode; tone?: "dark" | "light" | "fresh" }) {
  const c = { dark: "bg-forest text-white group-hover:bg-leaf-700", light: "bg-white text-forest group-hover:bg-leaf-50", fresh: "bg-fresh text-forest group-hover:bg-fresh-400" }[tone];
  return (
    <Link href={href} className="group inline-flex items-center gap-1 rounded-full text-body font-medium">
      <span className={cn("inline-flex h-13 items-center whitespace-nowrap rounded-full px-6 transition-colors duration-150", c)}>{children}</span>
      <span className={cn("grid size-13 shrink-0 place-items-center rounded-full transition-colors duration-150", c)} aria-hidden>
        <ArrowRight className="size-5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <span className={cn("grid size-12 shrink-0 place-items-center rounded-md", className)} aria-hidden><Icon className="size-6" strokeWidth={1.75} /></span>;
}

export function SectionHead({ id, title, text, children }: { id?: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <div className="max-w-xl">
        <h2 id={id} className="scroll-mt-6 text-balance text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium leading-tight tracking-tight text-forest">{title}</h2>
        {text && <p className="mt-3 text-body-lg text-neutral-700">{text}</p>}
      </div>
      {children}
    </div>
  );
}

/** Rounded hero panel: a photo with floating cards. */
export function HeroPanel({ photo, children, className }: { photo: Photo; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative min-h-96 overflow-hidden rounded-xl bg-forest", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.alt} fetchPriority="high" className={cn("absolute inset-0 size-full object-cover", photo.position)} />
      {children}
    </div>
  );
}

export const FACT_TILES = [
  { value: "1 day", text: "Every service in one place, once a year", className: "bg-leaf-600 text-white" },
  { value: "5 services", text: "Food, clothing, medical, counselling and prayer", className: "bg-forest text-white" },
  { value: "1 registration", text: "Give your details once, for every station", className: "bg-fresh text-forest" },
  { value: "Private", text: "Your QR code carries no personal details", className: "bg-fresh-100 text-forest" },
];

export function FactTiles() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FACT_TILES.map((t) => (
        <li key={t.value} className={cn("flex min-h-44 flex-col justify-between rounded-xl p-6", t.className)}>
          <p className="text-h1 font-medium tracking-tight">{t.value}</p>
          <p className="text-body">{t.text}</p>
        </li>
      ))}
    </ul>
  );
}
