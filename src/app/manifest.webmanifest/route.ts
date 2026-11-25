import type { MetadataRoute } from "next";

// A route, not app/manifest.ts: that convention links the app manifest on every page,
// and the public Cause a Smile pages must not offer to install the volunteer app.
export const dynamic = "force-static";

const manifest: MetadataRoute.Manifest = {
  name: "Gratitude Connect",
  short_name: "Gratitude",
  description: "Gratitude Outreach station app: scan, see, serve.",
  start_url: "/s",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#07210D",
  theme_color: "#07210D",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
