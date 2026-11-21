import { test, expect } from "@playwright/test";
import { joinStation, openByCode, rest, adminLogin, TRAINING_EDITION } from "./helpers";

async function medicalVisit() {
  const rows = await rest<{ visit_id: string }[]>(`confidential_records?kind=eq.medical&edition_id=eq.${TRAINING_EDITION}&select=visit_id&limit=1`);
  const v = await rest<{ id: string; card_code: string; beneficiary_id: string }[]>(`visits?id=eq.${rows[0]!.visit_id}&select=id,card_code,beneficiary_id`);
  return v[0]!;
}

test("medical staff see private medical notes; food volunteers only see 'Medical check'", async ({ browser }) => {
  const v = await medicalVisit();
  const med = await (await browser.newContext()).newPage();
  await joinStation(med, "444444", "Dr Amina", { rolePin: "404040" });
  await openByCode(med, v.card_code);
  await expect(med.getByText("Private medical notes")).toBeVisible();

  const food = await (await browser.newContext()).newPage();
  await joinStation(food, "555555", "Kunle");
  await openByCode(food, v.card_code);
  await expect(food.getByText(/Medical check/).first()).toBeVisible();
  await expect(food.getByText("Private medical notes")).toHaveCount(0);
  await expect(food.getByText("Training impression")).toHaveCount(0);
});

test("coordinators do not see confidential notes without break-glass", async ({ page }) => {
  const v = await medicalVisit();
  await adminLogin(page);
  await page.goto(`/admin/beneficiaries/${v.beneficiary_id}`);
  await expect(page.getByText("Confidential notes are hidden from admins.").first()).toBeVisible();
  await expect(page.getByText("Training impression")).toHaveCount(0);
});
