"use client";
/** Client-only navigation inside the /s shell (integrates with usePathname). */
export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.scrollTo({ top: 0 });
}
export function back(fallback = "/s") {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
}
