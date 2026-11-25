import { test, expect } from "@playwright/test";
import { joinStation, rest, waitSynced, TRAINING_EDITION } from "./helpers";

test("offline registration saves locally, then syncs once with no duplicates", async ({ page, context }) => {
  const cards = await rest<{ code: string }[]>(`cards?edition_id=eq.${TRAINING_EDITION}&status=eq.unassigned&select=code&order=code.desc&limit=1`);
  const code = cards[0]!.code;
  const name = `Offline Tester ${Date.now().toString().slice(-5)}`;

  await joinStation(page, "111111", "Tobi");
  await context.setOffline(true);

  await page.getByRole("button", { name: /New person/ }).click();
  await page.getByRole("button", { name: /Use a pre-printed card/ }).click();
  await expect(page.getByText("Scan pre-printed card")).toBeVisible();
  await page.getByRole("button", { name: /^Type (card code|number)$/ }).last().click();
  for (const d of code.split("-")[1]!) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /^Use/ }).click();

  await page.getByLabel(/Full name/).fill(name);
  await page.getByRole("radio", { name: "Female" }).click();
  await page.getByRole("button", { name: "36–59" }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Food/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByLabel(/Agrees to us recording/).check();
  await page.getByRole("button", { name: "Save registration" }).click();

  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sync status: Offline · \d+ pending/ })).toBeVisible();
  expect(await rest<unknown[]>(`visits?card_code=eq.${code}&edition_id=eq.${TRAINING_EDITION}&select=id`)).toHaveLength(0);

  await context.setOffline(false);
  await waitSynced(page);
  const visits = await rest<{ id: string }[]>(`visits?card_code=eq.${code}&edition_id=eq.${TRAINING_EDITION}&select=id`);
  expect(visits).toHaveLength(1);
  const bens = await rest<unknown[]>(`beneficiaries?full_name=eq.${encodeURIComponent(name)}&select=id`);
  expect(bens).toHaveLength(1);
  const card = await rest<{ status: string }[]>(`cards?code=eq.${code}&edition_id=eq.${TRAINING_EDITION}&select=status`);
  expect(card[0]!.status).toBe("assigned");
});

test("scanning an assigned card at Registration shows who it belongs to", async ({ page }) => {
  await joinStation(page, "111111", "Tobi");
  await page.getByRole("button", { name: /New person/ }).click();
  await page.getByRole("button", { name: /Use a pre-printed card/ }).click();
  await page.getByRole("button", { name: /^Type (card code|number)$/ }).last().click();
  for (const d of "0001") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /^Use/ }).click();
  await expect(page.getByRole("heading", { name: /Card already belongs to/ })).toBeVisible();
});

test("registration prints a QR slip offline; another station scans it and ticks what was done", async ({ browser }) => {
  const name = `Slip Tester ${Date.now().toString().slice(-5)}`;
  const regCtx = await browser.newContext();
  const reg = await regCtx.newPage();
  await joinStation(reg, "111111", "Tobi");
  await regCtx.setOffline(true);

  // Details -> needs -> consent -> save, no card scanned
  await reg.getByRole("button", { name: /New person/ }).click();
  await expect(reg.getByText("QR slip is printed after saving")).toBeVisible();
  await reg.getByLabel(/Full name/).fill(name);
  await reg.getByRole("radio", { name: "Male", exact: true }).click();
  await reg.getByRole("button", { name: "18–35" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByRole("button", { name: "Food" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByLabel(/Agrees to us recording/).check();
  await reg.getByRole("button", { name: "Save registration" }).click();

  // A code was generated on the phone, shown as a QR, ready to print
  await expect(reg.getByText(/is registered/)).toBeVisible();
  const code = (await reg.getByTestId("new-code").textContent())!.trim();
  expect(code).toMatch(/^TR26-\d{4}$/);
  await expect(reg.getByRole("img", { name: `QR code for ${code}` }).first()).toBeVisible();
  await reg.evaluate(() => { window.print = () => { document.body.dataset.printed = "1"; }; });
  await reg.getByRole("button", { name: "Print QR slip" }).click();
  expect(await reg.evaluate(() => document.documentElement.classList.contains("printing-slip"))).toBe(true);
  expect(await reg.evaluate(() => document.body.dataset.printed)).toBe("1");

  await regCtx.setOffline(false);
  await waitSynced(reg);
  const visits = await rest<{ id: string }[]>(`visits?card_code=eq.${code}&edition_id=eq.${TRAINING_EDITION}&select=id`);
  expect(visits).toHaveLength(1);

  // Counselling station: search, complete
  const prayCtx = await browser.newContext();
  const pray = await prayCtx.newPage();
  await joinStation(pray, "222222", "Ngozi");
  await pray.getByRole("button", { name: /Search name, phone, code/ }).click();
  await pray.getByLabel(/Search by name/).fill(name);
  await pray.getByRole("list", { name: "Results" }).getByRole("button").first().click();
  await pray.getByRole("button", { name: "Start Counselling" }).click();
  await pray.getByRole("radio", { name: /New Convert/ }).check();
  await pray.getByLabel("Received healing").check();
  await pray.getByRole("button", { name: "Complete Counselling" }).click();
  await expect(pray.getByText(/Saved · Counselling for/)).toBeVisible();
  await waitSynced(pray);

  const recs = await rest<{ summary: string; data: Record<string, unknown> }[]>(`service_records?visit_id=eq.${visits[0]!.id}&select=summary,data`);
  expect(recs).toEqual([{ summary: "Counselling completed", data: { counselled: true } }]);
  const needs = await rest<{ state: string }[]>(`visit_needs?visit_id=eq.${visits[0]!.id}&select=state`);
  expect(needs.map((n) => n.state).sort()).toEqual(["pending", "pending", "pending", "served"]);
  const fus = await rest<unknown[]>(`followups?visit_id=eq.${visits[0]!.id}&select=id`);
  expect(fus.length).toBeGreaterThan(0);
  await regCtx.close();
  await prayCtx.close();
});
