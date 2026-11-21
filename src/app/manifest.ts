import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
