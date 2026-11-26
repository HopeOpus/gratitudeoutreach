import { test, expect, type Page } from "@playwright/test";
import { joinStation, openByCode, rest, waitSynced, TRAINING_EDITION } from "./helpers";

// Pastor Ade's flow, one phone per station.
test("full journey: vitals, doctor, lab, optician, Counselling, Pharmacy gate, food", async ({ browser }) => {
  test.setTimeout(240_000);
  const name = `Journey ${Date.now()}`;
  const device = async (pin: string, who: string, rolePin?: string) => {
    const page = await (await browser.newContext()).newPage();
    await joinStation(page, pin, who, rolePin ? { rolePin } : {});
    return page;
  };
  const save = async (page: Page, button: string | RegExp) => { await page.getByRole("button", { name: button }).click(); await expect(page.getByText(/Saved · /)).toBeVisible(); await waitSynced(page); };
  const home = async (page: Page) => { await page.goto("/s"); await expect(page.getByRole("navigation", { name: "Station" })).toBeVisible(); await waitSynced(page); };

  // Registration: optional needs only
  const reg = await device("111111", "Tobi");
  await reg.getByRole("button", { name: /New person/ }).click();
  await reg.getByLabel(/Full name/).fill(name);
  await reg.getByRole("radio", { name: "Male", exact: true }).click();
  await reg.getByRole("button", { name: "36–59" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await expect(reg.getByText(/Everyone also goes to Medical Assistant, Counselling, Pharmacy/)).toBeVisible();
  const tiles = reg.getByRole("group", { name: "Needs" });
  await expect(tiles.getByRole("button")).toHaveText(["General Doctor", "Clothing", "Food"]);
  await tiles.getByRole("button", { name: "General Doctor" }).click();
  await tiles.getByRole("button", { name: "Food" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByLabel(/Agrees to us recording/).check();
  await reg.getByRole("button", { name: "Save registration" }).click();
  const code = (await reg.getByTestId("new-code").textContent())!.trim();
  await waitSynced(reg);
  const [visit] = await rest<{ id: string }[]>(`visits?card_code=eq.${code}&edition_id=eq.${TRAINING_EDITION}&select=id`);

  // Pharmacy is blocked before Counselling
  const ph = await device("777777", "Pharm Bayo", "707070");
  await openByCode(ph, code);
  await expect(ph.getByRole("heading", { name: "Counselling not completed" })).toBeVisible();
  await expect(ph.getByRole("button", { name: /No medicine needed|Give medicine/ })).toHaveCount(0);
  await ph.getByRole("button", { name: "Send to Counselling" }).click();
  await expect(ph.getByText(/sent to Counselling/)).toBeVisible();

  // Medical Assistant
  const ma = await device("131313", "Nurse Joy", "130130");
  await openByCode(ma, code);
  await ma.getByRole("button", { name: "Record vital signs" }).click();
  await ma.getByLabel(/BP systolic/).fill("999");
  await ma.getByRole("button", { name: "Save vital signs" }).click();
  await expect(ma.getByText(/Check BP systolic/)).toBeVisible();
  await ma.getByLabel(/BP systolic/).fill("150");
  await ma.getByLabel(/BP diastolic/).fill("95");
  // Temperature is never flagged; blood sugar is in mmol/L, so 11 is in range.
  await ma.getByLabel(/Temperature/).fill("27");
  await ma.getByLabel(/Blood sugar/).fill("11");
  await expect(ma.getByText(/Temp 27|RBS 11/)).toHaveCount(0);
  await save(ma, "Save vital signs");

  // Doctor sees vitals, has no vitals inputs, requests a test, prescribes, refers
  const doc = await device("444444", "Dr Amina", "404040");
  await openByCode(doc, code);
  await expect(doc.getByText("150/95 mmHg").first()).toBeVisible();
  await expect(doc.getByText("11 mmol/L").first()).toBeVisible();
  await doc.getByRole("button", { name: "See patient" }).click();
  await expect(doc.getByText("150/95 mmHg").first()).toBeVisible();
  await expect(doc.getByLabel(/BP systolic/)).toHaveCount(0);
  await doc.getByRole("textbox", { name: "Comments and observations" }).fill("Tired and pale");
  await doc.getByRole("button", { name: /^Prescription/ }).click();
  await doc.getByLabel("Find a medicine").fill("Paracet");
  await doc.getByLabel("Find a medicine").press("Enter"); // must not submit
  await doc.getByRole("button", { name: "+ Paracetamol 500mg" }).click();
  await doc.getByRole("button", { name: "1 tab twice daily" }).click();
  await doc.getByRole("button", { name: /^Request tests/ }).click();
  await doc.getByRole("button", { name: "PCV" }).click();
  await doc.getByRole("button", { name: /^Refer ?(✓ added)?$/ }).first().click();
  await doc.getByRole("switch", { name: /Refer to Optician/ }).click();
  await doc.getByRole("radio", { name: "Needed", exact: true }).click();
  await save(doc, "Save medical check");
  const shared = JSON.stringify(await rest(`service_records?visit_id=eq.${visit!.id}&select=summary,data`));
  for (const secret of ["PCV", "Paracetamol", "pale", "150", "surgery"]) expect(shared).not.toContain(secret);

  // Laboratory and Optician
  const lab = await device("151515", "Lab Sani", "150150");
  await openByCode(lab, code);
  await lab.getByRole("button", { name: "Record test results" }).click();
  await lab.getByLabel("PCV result").fill("28");
  await lab.getByLabel("Abnormal").check();
  await save(lab, /Save and send to General Doctor/);
  const opt = await device("141414", "Opt Uche", "140140");
  await openByCode(opt, code);
  await opt.getByRole("button", { name: "Record eye check" }).click();
  await opt.getByLabel("Right eye").fill("6/9");
  await save(opt, "Save eye check");

  // Results are back with the doctor
  await home(doc);
  await openByCode(doc, code);
  await expect(doc.getByText(/abnormal/).first()).toBeVisible();
  await expect(doc.getByText("Minor surgery needed").first()).toBeVisible();
  await doc.getByRole("button", { name: "See patient" }).click();
  await doc.getByRole("textbox", { name: "Comments and observations" }).fill("Reviewed");
  await save(doc, "Save medical check");

  // Food: warned, not blocked, and no medical detail
  const food = await device("555555", "Kunle");
  await openByCode(food, code);
  await expect(food.getByText(/Not done yet: Pharmacy/)).toBeVisible();
  await expect(food.getByText(/Laboratory|Optician|150\/95|surgery/i)).toHaveCount(0);

  // Counselling
  const c = await device("222222", "Sis Ngozi");
  await openByCode(c, code);
  await c.getByRole("button", { name: "Start Counselling" }).click();
  await expect(c.getByRole("button", { name: "Complete Counselling" })).toBeDisabled();
  await c.getByRole("radio", { name: /New Convert/ }).check();
  await c.getByRole("radio", { name: "New, today" }).click();
  await c.getByLabel("Received healing").check();
  await save(c, "Complete Counselling");
  const fus = await rest<{ type: string }[]>(`followups?visit_id=eq.${visit!.id}&select=type`);
  expect(fus.map((f) => f.type)).toContain("salvation");
  expect(JSON.stringify(await rest(`service_records?visit_id=eq.${visit!.id}&select=summary,data`))).not.toMatch(/convert|healing/i);

  // Pharmacy opens
  const before = (await rest<{ id: string; remaining: number }[]>(`inventory_items?edition_id=eq.${TRAINING_EDITION}&name=eq.Paracetamol%20500mg&select=id,remaining`))[0]!;
  await home(ph);
  await openByCode(ph, code);
  await expect(ph.getByText(/Prescribed by Dr Amina/)).toBeVisible();
  await save(ph, "Give medicine");
  const after = (await rest<{ remaining: number }[]>(`inventory_items?id=eq.${before.id}&select=remaining`))[0]!;
  expect(after.remaining).toBe(before.remaining - 1);

  await home(food);
  await openByCode(food, code);
  await expect(food.getByText(/Not done yet/)).toHaveCount(0);
  await save(food, "Save");
});

test("Pharmacy: offline Station Lead override is recorded; 'No medicine needed' completes the step", async ({ browser }) => {
  const visits = await rest<{ id: string; card_code: string; service_records: { id: string }[] }[]>(
    `visits?edition_id=eq.${TRAINING_EDITION}&select=id,card_code,service_records(id)&order=card_code.desc&limit=300`);
  const target = visits.find((v) => /^TR26-0\d{3}$/.test(v.card_code ?? "") && v.service_records.length === 0)!;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await joinStation(p, "777777", "Pharm Ada", { rolePin: "707070" });
  await ctx.setOffline(true);
  await openByCode(p, target.card_code);
  await p.getByRole("button", { name: "Station Lead override" }).click();
  await p.getByLabel("Station Lead name").fill("Sis Lead");
  await p.getByRole("button", { name: "Approve offline" }).click();
  await p.getByRole("button", { name: "No medicine needed" }).click();
  await expect(p.getByText(/Saved · Pharmacy for/)).toBeVisible();
  await ctx.setOffline(false);
  await waitSynced(p);
  const flags = await rest<{ kind: string }[]>(`flags?visit_id=eq.${target.id}&kind=eq.pharmacy_override_review&select=kind`);
  expect(flags).toHaveLength(1);
});
