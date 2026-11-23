import { expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";

// Reads local Supabase settings from .env.local (never commit real keys).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;
export const TRAINING_EDITION = "00000000-0000-4000-8000-0000000000e1";

/** Service-role REST query, test-only (ground truth). */
export async function rest<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

/** A fresh Nigerian number each call, so repeated runs never hit "already registered". */
export function testPhone(): string {
  return `080${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

/** Register a volunteer at a station (PIN + name + phone). Returns the phone used. */
export async function joinStation(page: Page, pin: string, name: string, opts: { rolePin?: string; phone?: string } = {}) {
  const phone = opts.phone ?? testPhone();
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill(pin);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel(/^Phone number/).fill(phone);
  if (opts.rolePin) {
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel(/Role PIN/).fill(opts.rolePin);
    await page.getByLabel("I agree to keep information confidential").check();
    await page.getByRole("button", { name: "Start serving" }).click();
  } else {
    await page.getByRole("button", { name: "Register and start" }).click();
  }
  await page.waitForURL("**/s");
  // Offline prep finishes, then station home appears
  await expect(page.getByRole("navigation", { name: "Station" })).toBeVisible({ timeout: 30_000 });
  return phone;
}

/** Sign in to an existing volunteer account on this device. */
export async function signInVolunteer(page: Page, name: string, phone: string, opts: { rolePin?: string } = {}) {
  await page.goto("/join");
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel(/^Phone number/).fill(phone);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (opts.rolePin) {
    await page.getByLabel(/Role PIN/).fill(opts.rolePin);
    await page.getByLabel("I agree to keep information confidential").check();
    await page.getByRole("button", { name: "Start serving" }).click();
  }
  await page.waitForURL("**/s");
  await expect(page.getByRole("navigation", { name: "Station" })).toBeVisible({ timeout: 30_000 });
}

export async function openByCode(page: Page, code: string) {
  await page.getByRole("button", { name: /^Type (card code|number)$/ }).first().click();
  const digits = code.split("-").pop()!;
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^Open`) }).click();
}

export async function waitSynced(page: Page) {
  await expect(page.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });
}

export async function newDevice(context: BrowserContext) {
  return context.newPage();
}

export async function adminLogin(page: Page, email = "coordinator@gratitude.test") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Gratitude2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}

/** Service-role PATCH, test-only. */
export async function restPatch(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

/** Test-only: forget failed PIN attempts so rate-limit tests don't lock out later tests. */
export async function clearFailedJoins() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/join_attempts?success=eq.false`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
