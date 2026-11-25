import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { joinStation, openByCode, adminLogin } from "./helpers";

// WCAG 2.2 AA (incl. colour contrast for sunlight readability). Fails on serious/critical issues.
async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const msg = bad.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
  if (bad.length) console.log(`\n### ${name}\n${msg}`);
  expect(bad.length, `${name}\n${msg}`).toBe(0);
}

/** Opens the station form, whether or not the person was served here before. */
async function startForm(p: Page, button: string) {
  const first = p.getByRole("button", { name: button });
  const again = p.getByRole("button", { name: "Record again" });
  await first.or(again).first().waitFor();
  if (await first.isVisible()) return first.click();
  await again.click();
  await p.getByRole("dialog").getByRole("button", { name: "Record again" }).click();
}

test("volunteer screens pass axe", async ({ page }) => {
  await page.goto("/join");
  await audit(page, "join");
  await joinStation(page, "555555", "Kunle");
  await audit(page, "station home");
  await openByCode(page, "TR26-0012");
  await audit(page, "profile");
  const more = page.getByRole("button", { name: /More details/ });
  if (await more.isVisible().catch(() => false)) { await more.click(); await audit(page, "food form"); }
});

test("registration and medical forms pass axe", async ({ browser }) => {
  test.setTimeout(180_000);
  const r = await (await browser.newContext()).newPage();
  await joinStation(r, "111111", "Tobi");
  await r.getByRole("button", { name: /New person/ }).click();
  await r.getByLabel(/Full name/).waitFor();
  await audit(r, "registration details");

  const m = await (await browser.newContext()).newPage();
  await joinStation(m, "444444", "Dr Amina", { rolePin: "404040" });
  await openByCode(m, "TR26-0020");
  await m.getByRole("heading", { name: "Today" }).waitFor();
  await audit(m, "doctor profile");
  await startForm(m, "See patient");
  await m.getByRole("button", { name: /Save medical check/ }).waitFor();
  await audit(m, "medical form");

  for (const [pin, role, button, save] of [
    ["131313", "130130", "Record vital signs", "Save vital signs"], ["151515", "150150", "Record test results", "Save and send"],
    ["141414", "140140", "Record eye check", "Save eye check"], ["222222", undefined, "Start Counselling", "Complete Counselling"],
  ] as const) {
    const p = await (await browser.newContext()).newPage();
    await joinStation(p, pin, "Axe", role ? { rolePin: role } : {});
    await openByCode(p, "TR26-0300");
    await startForm(p, button);
    await p.getByRole("button", { name: new RegExp(save) }).waitFor();
    await audit(p, button);
  }
});

test("admin screens pass axe", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })).newPage();
  await adminLogin(page, "admin@gratitude.test");
  for (const path of ["/admin", "/admin/editions", "/admin/follow-ups", "/admin/reports", "/admin/beneficiaries", "/admin/audit", "/admin/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await audit(page, path);
  }
});

test("large system font (200%) keeps the station loop usable", async ({ page }) => {
  await joinStation(page, "555555", "Kunle");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const scan = page.getByRole("button", { name: "Scan QR code" });
  await expect(scan).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
