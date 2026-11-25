import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Sora 300/400/500 ONLY (DesignSystem §4). Self-hosted at build so it works offline.
const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Gratitude Connect", template: "%s · Gratitude Connect" },
  description: "Register once. Every station sees what happened before. Gratitude Outreach service tracking.",
  applicationName: "Gratitude Connect",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Gratitude", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07210D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
