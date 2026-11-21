"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

let client: Promise<SupabaseClient<Database>> | null = null;

/**
 * Volunteer client: anonymous auth persisted in localStorage under its own key,
 * so it never collides with an admin cookie session on the same browser.
 * Loaded lazily: the station shell renders from IndexedDB first, keeping
 * supabase-js (~80 KB gzip) out of the initial /s bundle.
 */
export function volunteerClient(): Promise<SupabaseClient<Database>> {
  if (!client) {
    client = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storageKey: "gc-volunteer-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 20 } },
      }),
    );
  }
  return client;
}

export async function ensureAnonymousUser(): Promise<string> {
  const sb = await volunteerClient();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error("Could not start a session");
  return signed.user.id;
}
