import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Never auto-reload when the network returns: it would wipe a half-filled form.
  reloadOnOnline: false,
  cacheOnNavigation: false,
  additionalPrecacheEntries: [
    { url: "/s", revision },
    { url: "/join", revision },
    { url: "/", revision },
  ],
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // A separate build folder lets the e2e build run while `pnpm dev` uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  // PDF routes read logos and Sora font files from disk.
  outputFileTracingIncludes: {
    "/api/**": ["./public/icons/**", "./node_modules/@fontsource/sora/files/sora-latin-*-normal.woff"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSerwist(nextConfig);
