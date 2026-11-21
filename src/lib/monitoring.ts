"use client";
// Minimal error reporting with NO personal data: messages are scrubbed of
// phone numbers, emails, card codes and UUIDs; URLs keep only their route shape.
// Reports go to /api/client-errors (server logs). Swap in Sentry later if wanted.

const PHONE = /\+?\d[\d\s-]{8,}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CARD = /\b[A-Z0-9]{2,6}-(?:R\d{1,3}-)?\d{3,5}\b/g;

export function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").replace(UUID, ":id").replace(CARD, "[card]").replace(PHONE, "[number]").slice(0, 500);
}

export function routeShape(path: string): string {
  return path.replace(UUID, ":id").split("?")[0]!;
}

let sent = 0;
export function reportError(error: unknown, context: { where: string; digest?: string } ) {
  if (typeof window === "undefined" || sent > 20) return; // cap per page load
  if ((error as { name?: string })?.name === "SessionEndedError") return; // expected after revoke/expiry
  sent++;
  const e = error as { name?: string; message?: string; stack?: string };
  const body = JSON.stringify({
    where: context.where,
    digest: context.digest,
    name: e?.name ?? "Error",
    message: scrub(String(e?.message ?? error)),
    stack: scrub((e?.stack ?? "").split("\n").slice(0, 6).join("\n")),
    route: routeShape(window.location.pathname),
    online: navigator.onLine,
    ua: navigator.userAgent.slice(0, 120),
    at: new Date().toISOString(),
  });
  try {
    if (!navigator.sendBeacon?.("/api/client-errors", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch { /* offline: nothing to do */ }
}

let installed = false;
export function installGlobalErrorHandlers(where: string) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, { where }));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, { where: `${where}:promise` }));
}
