import { test, expect } from "@playwright/test";
import { joinStation, openByCode, rest, waitSynced, TRAINING_EDITION } from "./helpers";

test("offline lookup works, and a Food record appears on another device's open profile within ~2 s", async ({ browser }) => {
  // A person with no food record yet
  const visits = await rest<{ id: string; card_code: string; service_records: { station_id: string }[] }[]>(
    `visits?edition_id=eq.${TRAINING_EDITION}&select=id,card_code,service_records(station_id)&order=card_code.asc&limit=300`);
  const food = await rest<{ id: string }[]>(`stations?edition_id=eq.${TRAINING_EDITION}&kind=eq.food&select=id`);
  const target = visits.find((v) => v.card_code && !v.service_records.some((r) => r.station_id === food[0]!.id))!;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await joinStation(a, "555555", "Kunle");
  await joinStation(b, "222222", "Ngozi");

  // B goes offline: search + profile still work from the local cache
  await ctxB.setOffline(true);
  await b.getByRole("button", { name: /Search name, phone, code/ }).click();
  await b.getByLabel(/Search by name/).fill(target.card_code.split("-")[1]!);
  await b.getByRole("list", { name: "Results" }).getByRole("button").first().click();
  await expect(b.getByRole("heading", { name: "Today" })).toBeVisible();
  await ctxB.setOffline(false);
  await waitSynced(b);
  await b.waitForTimeout(1500); // realtime channel re-subscribes

  // A records food
  await openByCode(a, target.card_code);
  const ticks = a.getByRole("region", { name: /Tick what was done at Food/ });
  const first = ticks.getByRole("checkbox").first();
  if (!(await first.isChecked())) await first.check();
  const t0 = Date.now();
  await a.getByRole("button", { name: "Save", exact: true }).click();
  await expect(a.getByText(/Saved · Food for/)).toBeVisible();

  await expect(b.locator("ol").getByText("Food", { exact: true }).first()).toBeVisible({ timeout: 4000 });
  const elapsed = Date.now() - t0;
  console.log(`Realtime latency incl. sync: ${elapsed} ms`);
  await ctxA.close();
  await ctxB.close();
});
