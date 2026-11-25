import Link from "next/link";
import { wrap } from "./bits";
import { CONTACT, DONATE_URL, OUTREACH_PATH, PHOTO_CREDITS, SITE_NAME, hasContact } from "@/lib/site";
import { cn } from "@/lib/utils";

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/causeasmile-logo.svg" alt={SITE_NAME} width={684} height={254} className="h-16 w-auto self-start" />;
}

const link = "inline-flex min-h-12 items-center rounded-sm underline-offset-4 hover:underline";

const pill = "inline-flex min-h-12 items-center rounded-full px-4 transition-colors duration-150 hover:bg-neutral-50";

export function SiteHeader() {
  return (
    <header className="text-forest">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:p-4">
        Skip to content
      </a>
      <div className={cn(wrap, "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4")}>
        <Link href="/" aria-label={`${SITE_NAME}, home`} className="inline-flex min-h-12 items-center"><Logo /></Link>
        <nav aria-label="Main" className="-mx-4 flex flex-wrap items-center text-body font-medium sm:mx-0">
          <Link href={OUTREACH_PATH} className={pill}>Gratitude Outreach</Link>
          <Link href={`${OUTREACH_PATH}#volunteer`} className={pill}>Volunteer</Link>
          {hasContact && <a href="#contact" className={pill}>Contact</a>}
          {DONATE_URL && <a href={DONATE_URL} className="ml-2 inline-flex min-h-12 items-center rounded-full bg-forest px-6 text-white hover:bg-leaf-700">Donate</a>}
        </nav>
      </div>
    </header>
  );
}

/** Dark rounded call to action with the smile arc. */
export function CtaPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={wrap}>
      <section className="relative overflow-hidden rounded-xl bg-forest px-6 py-14 text-white md:px-14 md:py-20">
        <svg viewBox="0 0 400 120" aria-hidden className="pointer-events-none absolute -bottom-6 -right-16 w-[34rem] max-md:opacity-30" fill="none" strokeWidth="16" strokeLinecap="round">
          <path d="M20 10Q200 190 380 10" className="stroke-fresh" />
        </svg>
        <div className="relative">
          <h2 className="max-w-lg text-balance text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium leading-tight tracking-tight">{title}</h2>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-white text-forest md:mt-28">
      <div className={cn(wrap, "flex flex-col gap-10 py-14 md:flex-row md:justify-between")}>
        <Logo />
        {hasContact && (
          <address id="contact" className="flex flex-col text-body not-italic">
            {CONTACT.email && <a className={link} href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
            {CONTACT.phone && <a className={link} href={`tel:${CONTACT.phone}`}>{CONTACT.phone}</a>}
            {CONTACT.whatsapp && <a className={link} href={`https://wa.me/${CONTACT.whatsapp.replace(/\D/g, "")}`}>Chat on WhatsApp</a>}
            {CONTACT.address && <span className="py-3 text-neutral-700">{CONTACT.address}</span>}
          </address>
        )}
        <nav aria-label="Footer" className="flex flex-col text-body">
          <Link className={link} href={OUTREACH_PATH}>Gratitude Outreach</Link>
          <Link className={link} href={`${OUTREACH_PATH}/team`}>Volunteer and team sign in</Link>
        </nav>
      </div>
      <div className={cn(wrap, "pb-10")}>
        <details className="text-caption text-neutral-700">
          <summary className="inline-flex min-h-12 cursor-pointer items-center underline underline-offset-4">Photo credits</summary>
          <p className="max-w-2xl">Clothing and outreach-day photos are from our own event. The others are illustrative, cropped and resized, from Wikimedia Commons:</p>
          <ul className="mt-2 grid gap-1">
            {PHOTO_CREDITS.map((c) => (
              <li key={c.url}>
                {c.subject}: <a className="underline" href={c.url}>{c.title}</a> by {c.by}, <a className="underline" href={c.licenseUrl}>{c.license}</a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
