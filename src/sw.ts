/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin; } catch { return ""; }
})();

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Personal data never goes into the SW cache: Supabase is handled by Dexie, admin is online-only.
    { matcher: ({ url }) => url.origin === supabaseOrigin, handler: new NetworkOnly() },
    { matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/admin"), handler: new NetworkOnly() },
    { matcher: ({ url, sameOrigin, request }) => sameOrigin && url.pathname.startsWith("/api/") && request.method === "GET",
      handler: new NetworkFirst({ cacheName: "api", networkTimeoutSeconds: 3 }) },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      { url: "/s", matcher: ({ request }) => request.destination === "document" && new URL(request.url).pathname.startsWith("/s") },
      { url: "/join", matcher: ({ request }) => request.destination === "document" && new URL(request.url).pathname.startsWith("/join") },
    ],
  },
});

serwist.addEventListeners();
