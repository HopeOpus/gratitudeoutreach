import { test, expect } from "@playwright/test";
import { joinStation, rest, waitSynced, TRAINING_EDITION } from "./helpers";

test("offline registration saves locally, then syncs once with no duplicates", async ({ page, context }) => {
  const cards = await rest<{ code: string }[]>(`cards?edition_id=eq.${TRAINING_EDITION}&status=eq.unassigned&select=code&order=code.desc&limit=1`);
  const code = cards[0]!.code;
  const name = `Offline Tester ${Date.now().toString().slice(-5)}`;

  await joinStation(page, "111111", "Tobi");
  await context.setOffline(true);

  await page.getByRole("button", { name: /New person/ }).click();
  await expect(page.getByText("Scan blank card")).toBeVisible();
  await page.getByRole("button", { name: "Type card code" }).last().click();
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
  await expect(page.getByText("Scan blank card")).toBeVisible();
  await page.getByRole("button", { name: "Type card code" }).last().click();
  for (const d of "0001") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /^Use/ }).click();
  await expect(page.getByRole("heading", { name: /Card already belongs to/ })).toBeVisible();
});
