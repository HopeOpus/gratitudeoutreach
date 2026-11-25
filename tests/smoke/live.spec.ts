import { test, expect, type Page } from "@playwright/test";

const phone = () => `080${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

async function synced(page: Page) {
  await page.waitForURL("**/s");
  await expect(page.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 60_000 });
}

/** Register a volunteer account at a station. Returns the phone number used. */
async function join(page: Page, pin: string, name: string) {
  const tel = phone();
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill(pin);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel(/^Phone number/).fill(tel);
  await page.getByRole("button", { name: "Register and start" }).click();
  await synced(page);
  return tel;
}

test("live: register with QR slip, complete Counselling, see it on the admin dashboard", async ({ browser }) => {
  const name = `Smoke Test ${Date.now().toString().slice(-5)}`;

  const reg = await (await browser.newContext()).newPage();
  await join(reg, "111111", "Smoke Reg");
  await reg.getByRole("button", { name: /New person/ }).click();
  await reg.getByLabel(/Full name/).fill(name);
  await reg.getByRole("radio", { name: "Female", exact: true }).click();
  await reg.getByRole("button", { name: "18–35" }).click();
  await reg.getByRole("button", { name: /Next/ }).click();
  await reg.getByRole("button", { name: "Food" }).click();
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
  await pray.getByRole("button", { name: "Start Counselling" }).click();
  await pray.getByRole("radio", { name: /Already Born Again/ }).check();
  await pray.getByLabel("Received healing").check();
  await pray.getByRole("button", { name: "Complete Counselling" }).click();
  await expect(pray.getByText(/Saved · Counselling for/)).toBeVisible();
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
  await expect(feed.getByText(/Counselling completed/).first()).toBeVisible();
  await adm.screenshot({ path: "test-results/smoke-admin.png" });
});

async function joinConfidential(page: Page, pin: string, name: string, rolePin: string) {
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill(pin);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel(/^Phone number/).fill(phone());
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/Role PIN/).fill(rolePin);
  await page.getByLabel("I agree to keep information confidential").check();
  await page.getByRole("button", { name: "Start serving" }).click();
  await synced(page);
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
  await reg.getByRole("button", { name: "General Doctor" }).click();
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
  await med.getByRole("button", { name: "See patient" }).click();
  await med.getByRole("button", { name: /^Prescription/ }).click();
  await med.getByLabel("Find a medicine").fill("Paracet");
  await med.getByRole("button", { name: "+ Paracetamol 500mg" }).click();
  await med.getByRole("button", { name: "1 tab twice daily" }).click();
  await med.getByRole("button", { name: "Save medical check" }).click();
  await expect(med.getByText(/Saved · General Doctor for/)).toBeVisible();
  await expect(med.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });

  const ph = await (await browser.newContext()).newPage();
  await joinConfidential(ph, "777777", "Smoke Pharm", "707070");
  await ph.getByRole("button", { name: /Search name, phone, code/ }).click();
  await ph.getByLabel(/Search by name/).fill(name);
  await ph.getByRole("list", { name: "Results" }).getByRole("button").first().click({ timeout: 30_000 });
  // Locked until Counselling is done
  await expect(ph.getByRole("heading", { name: "Counselling not completed" })).toBeVisible();
  const couns = await (await browser.newContext()).newPage();
  await join(couns, "222222", "Smoke Counsellor");
  await couns.getByRole("button", { name: /Search name, phone, code/ }).click();
  await couns.getByLabel(/Search by name/).fill(code);
  await couns.getByRole("list", { name: "Results" }).getByRole("button").first().click({ timeout: 30_000 });
  await couns.getByRole("button", { name: "Start Counselling" }).click();
  await couns.getByRole("radio", { name: /Neither/ }).check();
  await couns.getByRole("button", { name: "Complete Counselling" }).click();
  await expect(couns.getByText(/Saved · Counselling for/)).toBeVisible();
  await expect(ph.getByText(/Prescribed by Smoke Doctor/)).toBeVisible({ timeout: 45_000 });
  await expect(ph.getByLabel(/Paracetamol 500mg × 1/)).toBeChecked();
  await ph.getByRole("button", { name: "Give medicine" }).click();
  await expect(ph.getByText(/Saved · Pharmacy for/)).toBeVisible();
  await expect(ph.getByRole("button", { name: /Sync status: Synced/ })).toBeVisible({ timeout: 30_000 });
});

test("live: one volunteer account signs in on two phones", async ({ browser }) => {
  const name = `Smoke Vol ${Date.now().toString().slice(-5)}`;
  const a = await (await browser.newContext()).newPage();
  const tel = await join(a, "555555", name);

  const b = await (await browser.newContext()).newPage();
  await b.goto("/join");
  await b.getByLabel(/^Name/).fill(name);
  await b.getByLabel(/^Phone number/).fill(phone());
  await b.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(b.getByText(/Account not found/)).toBeVisible();
  await b.getByLabel(/^Phone number/).fill(tel);
  await b.getByRole("button", { name: "Sign in", exact: true }).click();
  await synced(b);

  await a.reload();
  await expect(a.getByRole("navigation", { name: "Station" })).toBeVisible({ timeout: 30_000 });
});
