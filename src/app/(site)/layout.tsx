import type { Metadata, Viewport } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  // Public pages: indexable, and no volunteer-app install prompt.
  robots: { index: true, follow: true },
  manifest: null,
  appleWebApp: null,
  icons: { icon: "/brand/causeasmile-icon.svg" },
};

export const viewport: Viewport = { themeColor: "#FAF9FC" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
