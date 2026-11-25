import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { FactTiles, HeroPanel, IconTile, PillLink, SectionHead, wrap } from "@/components/site/bits";
import { CtaPanel, SiteFooter, SiteHeader } from "@/components/site/chrome";
import { ServiceGrid } from "@/components/site/services";
import { NEXT_OUTREACH, OUTREACH_PATH, PHOTOS, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const description = "Cause a Smile Initiative is the NGO behind Gratitude Outreach, a yearly day of food, clothing, free medical checks, counselling and prayer.";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, url: "/", title: SITE_NAME, description, images: [{ url: "/brand/og-causeasmile.png", width: 1200, height: 630, alt: SITE_NAME }] },
};

export default function Home() {
  return (
    <div className="theme-smile bg-neutral-25 text-ink">
      <SiteHeader />
      <main id="main" className="flex flex-col gap-20 md:gap-28">
        <section className={cn(wrap, "grid items-stretch gap-10 pt-4 md:grid-cols-2 md:pt-6")}>
          <div className="self-center md:py-16">
            <h1 className="text-balance text-[clamp(2.5rem,5.2vw,4rem)] font-medium leading-[1.06] tracking-tight text-forest">
              Give someone a reason to smile
            </h1>
            <p className="mt-6 max-w-md text-pretty text-h3 font-normal text-neutral-700">{description}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PillLink href={OUTREACH_PATH}>Need help?</PillLink>
              <PillLink href={`${OUTREACH_PATH}#volunteer`} tone="light">Want to help?</PillLink>
            </div>
          </div>
          <HeroPanel photo={PHOTOS.home} className="md:min-h-[36rem]">
            <Link href={OUTREACH_PATH} className="absolute inset-x-4 bottom-4 flex items-center gap-4 rounded-lg bg-white p-4 text-forest hover:bg-leaf-50 sm:left-auto sm:w-80">
              <IconTile icon={CalendarDays} className="bg-leaf-50 text-leaf-700" />
              <span>
                <span className="block text-caption text-neutral-700">Next Gratitude Outreach</span>
                <span className="block text-body font-medium">{NEXT_OUTREACH.date ?? "Date to be announced"}</span>
              </span>
            </Link>
          </HeroPanel>
        </section>

        <section aria-labelledby="outreach" className={wrap}>
          <SectionHead id="outreach" title="Our work: Gratitude Outreach" text="People come for what they need and are looked after by volunteers at each station.">
            <Link href={`${OUTREACH_PATH}#day`} className="inline-flex min-h-12 items-center font-medium text-leaf-700 underline underline-offset-4">How the day works</Link>
          </SectionHead>
          <div className="mt-8"><FactTiles /></div>
        </section>

        <section aria-labelledby="services" className={wrap}>
          <SectionHead id="services" title="What people receive" />
          <div className="mt-8"><ServiceGrid /></div>
        </section>

        <CtaPanel title="See how one day comes together">
          <PillLink href={OUTREACH_PATH} tone="fresh">Explore the outreach</PillLink>
        </CtaPanel>
      </main>
      <SiteFooter />
    </div>
  );
}
