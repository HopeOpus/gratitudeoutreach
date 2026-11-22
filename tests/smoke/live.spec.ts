import { test, expect, type Page } from "@playwright/test";

async function join(page: Page, pin: string, name: string) {
  await page.goto("/join");
  await page.getByLabel("Station PIN").fill(pin);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel(/First name/).fill(name);
  await page.getByRole("button", { name: "Start serving" }).click();
  await page.waitForURL("**/s");
  await expect(page.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 60_000 });
}

test("live: register with QR slip, tick at Prayer, see it on the admin dashboard", async ({ browser }) => {
  const name = `Smoke Test ${Date.now().toString().slice(-5)}`;

  const reg = await (await browser.newContext()).newPage();
  await join(reg, "111111", "Smoke Reg");
  await reg.getByRole("button", { name: /New person/ }).click();
  await reg.getByLabel(/Full name/).fill(name);
  await reg.getByRole("radio", { name: "Female", exact: true }).click();
  await reg.getByRole("button", { name: "18–35" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByRole("button", { name: /Prayer/ }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByLabel(/Agrees to us recording/).check();
  await reg.getByRole("button", { name: "Save registration" }).click();
  await expect(reg.getByText(/is registered/)).toBeVisible();
  const code = (await reg.getByTestId("new-code").textContent())!.trim();
  expect(code).toMatch(/^TR26-\d{4}$/);
  await expect(reg.getByRole("img", { name: `QR code for ${code}` }).first()).toBeVisible();
  await expect(reg.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });

  const pray = await (await browser.newContext()).newPage();
  await join(pray, "222222", "Smoke Prayer");
  await pray.getByRole("button", { name: /Search name, phone, code/ }).click();
  await pray.getByLabel(/Search by name/).fill(code);
  await pray.getByRole("list", { name: "Results" }).getByRole("button").first().click({ timeout: 30_000 });
  const ticks = pray.getByRole("region", { name: /Tick what was done at Prayer/ });
  await expect(ticks.getByLabel("Has been prayed for")).toBeChecked();
  await ticks.getByLabel("Received healing").check();
  await pray.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pray.getByText(/Saved · Prayer & Counselling for/)).toBeVisible();
  await expect(pray.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });

  const email = process.env.SMOKE_ADMIN_EMAIL, password = process.env.SMOKE_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to check the dashboard");
  const adm = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false })).newPage();
  await adm.goto("/admin/login");
  await adm.getByLabel("Email").fill(email!);
  await adm.getByLabel("Password").fill(password!);
  await adm.getByRole("button", { name: "Sign in" }).click();
  await adm.waitForURL("**/admin");
  await adm.getByRole("combobox", { name: "Edition" }).selectOption({ label: "Training 2026 (training)" });
  const feed = adm.getByRole("region", { name: "Live activity" }).or(adm.locator("[aria-labelledby=live-h]"));
  await expect(feed.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  await expect(feed.getByText(/Prayed for · Healing/).first()).toBeVisible();
  await adm.screenshot({ path: "test-results/smoke-admin.png" });
});

async function joinConfidential(page: Page, pin: string, name: string, rolePin: string) {
  await page.goto("/join");
  await page.getByLabel("Station PIN").fill(pin);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel(/First name/).fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/Role PIN/).fill(rolePin);
  await page.getByLabel("I agree to keep information confidential").check();
  await page.getByRole("button", { name: "Start serving" }).click();
  await page.waitForURL("**/s");
  await expect(page.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 60_000 });
}

test("live: Medical prescribes, Pharmacy sees the prescription and dispenses", async ({ browser }) => {
  const name = `Smoke Rx ${Date.now().toString().slice(-5)}`;
  const reg = await (await browser.newContext()).newPage();
  await join(reg, "111111", "Smoke Reg");
  await reg.getByRole("button", { name: /New person/ }).click();
  await reg.getByLabel(/Full name/).fill(name);
  await reg.getByRole("radio", { name: "Male", exact: true }).click();
  await reg.getByRole("button", { name: "36–59" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByRole("button", { name: /Medical/ }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByLabel(/Agrees to us recording/).check();
  await reg.getByRole("button", { name: "Save registration" }).click();
  const code = (await reg.getByTestId("new-code").textContent())!.trim();
  await expect(reg.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });

  const med = await (await browser.newContext()).newPage();
  await joinConfidential(med, "444444", "Smoke Doctor", "404040");
  await med.getByRole("button", { name: /Search name, phone, code/ }).click();
  await med.getByLabel(/Search by name/).fill(code);
  await med.getByRole("list", { name: "Results" }).getByRole("button").first().click({ timeout: 30_000 });
  const t = med.getByRole("region", { name: /Tick what was done at Medical/ });
  await t.getByLabel("Find a medicine").fill("Paracet");
  await t.getByRole("button", { name: "+ Paracetamol 500mg" }).click();
  await t.getByRole("group", { name: "Paracetamol 500mg dosage" }).getByRole("button", { name: "1 tab twice daily" }).click();
  await med.getByRole("button", { name: "Save", exact: true }).click();
  await expect(med.getByText(/sent to Pharmacy/)).toBeVisible();
  await expect(med.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });

  const ph = await (await browser.newContext()).newPage();
  await joinConfidential(ph, "777777", "Smoke Pharm", "707070");
  await ph.getByRole("button", { name: /Search name, phone, code/ }).click();
  await ph.getByLabel(/Search by name/).fill(name);
  await ph.getByRole("list", { name: "Results" }).getByRole("button").first().click({ timeout: 30_000 });
  const rx = ph.getByRole("region", { name: /Tick what was done at Pharmacy/ });
  await expect(rx.getByText(/Prescribed by Smoke Doctor/)).toBeVisible({ timeout: 30_000 });
  await expect(rx.getByLabel(/Paracetamol 500mg × 1/)).toBeChecked();
  await ph.getByRole("button", { name: "Save", exact: true }).click();
  await expect(ph.getByText(/Saved · Pharmacy for/)).toBeVisible();
  await expect(ph.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });
});
