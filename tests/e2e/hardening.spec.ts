import { test, expect } from "@playwright/test";
import { joinStation, restPatch, clearFailedJoins } from "./helpers";

test.beforeEach(clearFailedJoins);
test.afterAll(clearFailedJoins);

test("revoking a session purges the device's local data", async ({ page }) => {
  const name = `Revoke ${Date.now().toString().slice(-5)}`;
  await joinStation(page, "666666", name);
  const before = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(before).toContain("gratitude-connect");

  await restPatch(`volunteer_sessions?display_name=eq.${encodeURIComponent(name)}&revoked_at=is.null`, { revoked_at: new Date().toISOString() });
  // The next heartbeat (on start, then every 30 s) sees the revocation. It may already be in
  // flight; otherwise a reload triggers one. Either way the device must end up wiped on /join.
  await page.waitForURL("**/join**", { timeout: 3000 }).catch(async () => { await page.reload(); });
  await page.waitForURL("**/join**", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  // The join page may open a fresh (empty) database; nothing from the old session may remain.
  const left = await page.evaluate(() => new Promise<{ visits: number; meta: number }>((resolve) => {
    const req = indexedDB.open("gratitude-connect");
    req.onsuccess = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains("visits")) { idb.close(); resolve({ visits: 0, meta: 0 }); return; }
      const tx = idb.transaction(["visits", "meta"], "readonly");
      const v = tx.objectStore("visits").count();
      const m = tx.objectStore("meta").count();
      tx.oncomplete = () => { resolve({ visits: v.result, meta: m.result }); idb.close(); };
    };
  }));
  expect(left).toEqual({ visits: 0, meta: 0 });
  expect(await page.evaluate(() => localStorage.getItem("gc-volunteer-auth"))).toBeNull();
});

test("five wrong PINs lock the device out for 5 minutes", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Station PIN").fill(`00000${i}`);
    await expect(page.getByText("That PIN doesn't match a station")).toBeVisible();
  }
  await page.getByLabel("Station PIN").fill("555555");
  await expect(page.getByText(/Too many tries/)).toBeVisible();
});

test("five wrong sign-ins lock the device out too", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/join");
  await page.getByLabel(/^Name/).fill("Nobody");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel(/^Phone number/).fill(`0809000000${i}`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/Account not found/)).toBeVisible();
  }
  await page.getByLabel(/^Phone number/).fill("08090000009");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Too many tries/)).toBeVisible();
});
