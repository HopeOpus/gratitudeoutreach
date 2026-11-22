import { test, expect } from "@playwright/test";
import { joinStation, openByCode, rest, waitSynced, TRAINING_EDITION } from "./helpers";

test("Medical prescribes from the inventory; Pharmacy sees the prescription and dispenses it", async ({ browser }) => {
  const [med] = await rest<{ id: string }[]>(`stations?edition_id=eq.${TRAINING_EDITION}&kind=eq.medical&select=id`);
  const [pharm] = await rest<{ id: string }[]>(`stations?edition_id=eq.${TRAINING_EDITION}&kind=eq.pharmacy&select=id`);
  const visits = await rest<{ id: string; card_code: string; service_records: { station_id: string }[] }[]>(
    `visits?edition_id=eq.${TRAINING_EDITION}&select=id,card_code,service_records(station_id)&order=card_code.desc&limit=300`);
  const target = visits.find((v) => v.card_code && !v.service_records.some((r) => r.station_id === med!.id || r.station_id === pharm!.id))!;
  const [drug] = await rest<{ id: string; remaining: number }[]>(`inventory_items?edition_id=eq.${TRAINING_EDITION}&name=eq.Paracetamol%20500mg&select=id,remaining`);

  // Medical: seen + prescription
  const m = await (await browser.newContext()).newPage();
  await joinStation(m, "444444", "Dr Amina", { rolePin: "404040" });
  await openByCode(m, target.card_code);
  const ticks = m.getByRole("region", { name: /Tick what was done at Medical/ });
  await expect(ticks.getByLabel("Seen by the medical team")).toBeChecked();
  await ticks.getByLabel("Find a medicine").fill("Paracet");
  await ticks.getByRole("button", { name: "+ Paracetamol 500mg" }).click();
  await ticks.getByRole("button", { name: "Increase Paracetamol 500mg quantity" }).click();
  await ticks.getByRole("button", { name: "1 tab twice daily" }).click();
  await m.getByRole("button", { name: "Save", exact: true }).click();
  await expect(m.getByText(/sent to Pharmacy/)).toBeVisible();
  await waitSynced(m);

  const needs = await rest<{ state: string }[]>(`visit_needs?visit_id=eq.${target.id}&station_id=eq.${pharm!.id}&select=state`);
  expect(needs[0]?.state).toBe("referred");
  const recs = await rest<{ summary: string }[]>(`service_records?visit_id=eq.${target.id}&station_id=eq.${med!.id}&select=summary`);
  expect(recs[0]!.summary).toBe("Medical check"); // no medicine names on the shared timeline

  // Pharmacy: the person is in the queue with the prescription
  const p = await (await browser.newContext()).newPage();
  await joinStation(p, "777777", "Pharm Bayo", { rolePin: "707070" });
  await openByCode(p, target.card_code);
  const rx = p.getByRole("region", { name: /Tick what was done at Pharmacy/ });
  await expect(rx.getByText(/Prescribed by Dr Amina/)).toBeVisible();
  const line = rx.getByLabel(/Paracetamol 500mg × 2/);
  await expect(line).toBeChecked();
  await expect(rx.getByText("1 tab twice daily")).toBeVisible();
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await expect(p.getByText(/Saved · Pharmacy for/)).toBeVisible();
  await waitSynced(p);

  const disp = await rest<{ summary: string; data: { prescription_id: string; items: { item_id: string; qty: number }[] } }[]>(
    `service_records?visit_id=eq.${target.id}&station_id=eq.${pharm!.id}&select=summary,data`);
  expect(disp).toHaveLength(1);
  expect(disp[0]!.summary).toBe("Medicine given");
  expect(disp[0]!.data.items).toEqual([{ item_id: drug!.id, qty: 2 }]);
  const [after] = await rest<{ remaining: number }[]>(`inventory_items?id=eq.${drug!.id}&select=remaining`);
  expect(after!.remaining).toBe(drug!.remaining - 2);
});
