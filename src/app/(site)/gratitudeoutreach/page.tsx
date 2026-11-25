import type { Metadata } from "next";
import { CalendarDays, Lock, MapPin, Users } from "lucide-react";
import { HeroPanel, IconTile, PillLink, SectionHead, wrap } from "@/components/site/bits";
import { CtaPanel, SiteFooter, SiteHeader } from "@/components/site/chrome";
import { ServiceGrid } from "@/components/site/services";
import { NEXT_OUTREACH, OUTREACH_PATH, PHOTOS, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const title = `Gratitude Outreach · ${SITE_NAME}`;
const description = "A yearly day of food, clothing, free medical checks, counselling and prayer, hosted by Cause a Smile Initiative.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: OUTREACH_PATH },
  openGraph: { type: "website", siteName: SITE_NAME, url: OUTREACH_PATH, title, description, images: [{ url: "/brand/og-gratitude.png", width: 1200, height: 630, alt: "Gratitude Outreach" }] },
};

const STEPS = [
  { title: "Register once", text: "A volunteer takes your details, asks what you need, and asks for your consent to keep a record." },
  { title: "Get your code", text: "You receive a QR code with a short number. Keep it with you for the day." },
  { title: "Visit your stations", text: "Show your code at each one. You start with a medical check and see a counsellor before the pharmacy, then collect food and clothing." },
  { title: "Stay in touch, if you want", text: "With your permission, the team follows up after the day." },
];

export default function GratitudeOutreach() {
  const event = [
    { label: "Date", value: NEXT_OUTREACH.date, icon: CalendarDays },
    { label: "Venue", value: NEXT_OUTREACH.venue, icon: MapPin },
  ];
  return (
    <div className="bg-neutral-25 text-ink">
      <SiteHeader />
      <main id="main" className="flex flex-col gap-20 md:gap-28">
        <section className={cn(wrap, "grid gap-4 pt-2 md:grid-cols-2")}>
          <div className="flex flex-col justify-center rounded-xl bg-forest p-7 text-white md:min-h-[34rem] md:p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-52" />
            <h1 className="mt-8 text-balance text-[clamp(2.25rem,4.4vw,3.5rem)] font-medium leading-[1.08] tracking-tight">One day of care for the whole community</h1>
            <p className="mt-5 max-w-md text-h3 font-normal text-forest-100">{description}</p>
            <div className="mt-8"><PillLink href="#day" tone="fresh">How the day works</PillLink></div>
          </div>
          <HeroPanel photo={PHOTOS.outreach} className="max-lg:min-h-[33rem]">
            <dl className="absolute inset-x-4 bottom-4 grid gap-4 rounded-lg bg-white p-4 text-forest lg:grid-cols-2">
              {event.map((e) => (
                <div key={e.label} className="grid grid-cols-[3rem_1fr] gap-x-4">
                  <dt className="contents text-caption text-neutral-700"><IconTile icon={e.icon} className="row-span-2 bg-leaf-50 text-leaf-700" /><span className="self-end">{e.label}</span></dt>
                  <dd className="text-body font-medium">{e.value ?? "To be announced"}</dd>
                </div>
              ))}
            </dl>
          </HeroPanel>
        </section>

        <section aria-labelledby="services" className={wrap}>
          <SectionHead id="services" title="What you can receive" />
          <div className="mt-8"><ServiceGrid /></div>
        </section>

        <section aria-labelledby="day" className={wrap}>
          <SectionHead id="day" title="How the day works" />
          <ol className="mt-8 grid gap-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3.5rem_1fr] items-center gap-x-5 gap-y-1 rounded-xl bg-white p-5 shadow-sm md:grid-cols-[3.5rem_16rem_1fr]">
                <span aria-hidden className="grid size-14 place-items-center rounded-md bg-leaf-50 text-h2 font-medium tabular text-leaf-700 max-md:row-span-2 max-md:self-start">{i + 1}</span>
                <h3 className="text-h3 font-medium text-forest">{s.title}</h3>
                <p className="text-body-lg text-neutral-700">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={cn(wrap, "grid gap-4 md:grid-cols-2")}>
          <div className="rounded-xl bg-fresh-100 p-7 md:p-10">
            <IconTile icon={Lock} className="bg-white text-leaf-700" />
            <h2 className="mt-6 text-h1 font-medium tracking-tight text-forest">Your privacy</h2>
            <p className="mt-3 text-body-lg text-forest">Your QR code holds only your number, with no personal details. Medical notes are kept separate and restricted to the people who need them.</p>
          </div>
          <div id="volunteer" className="scroll-mt-6 rounded-xl bg-white p-7 shadow-sm md:p-10">
            <IconTile icon={Users} className="bg-leaf-600 text-white" />
            <h2 className="mt-6 text-h1 font-medium tracking-tight text-forest">Volunteering</h2>
            <p className="mt-3 text-body-lg text-neutral-700">On the day, join your station with the PIN or QR poster from your coordinator. Register with your name and phone number, then sign in on any device.</p>
          </div>
        </section>

        <CtaPanel title="Already on the volunteer team?">
          <PillLink href="/join" tone="fresh">Join a station</PillLink>
        </CtaPanel>
      </main>
      <SiteFooter />
    </div>
  );
}
