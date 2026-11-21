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

test("volunteer screens pass axe", async ({ page }) => {
  await page.goto("/join");
  await audit(page, "join");
  await joinStation(page, "555555", "Kunle");
  await audit(page, "station home");
  await openByCode(page, "TR26-0012");
  await audit(page, "profile");
  await page.getByRole("button", { name: /Record Food service|Already served/ }).click();
  if (await page.getByRole("dialog").isVisible().catch(() => false)) await page.keyboard.press("Escape");
  else await audit(page, "food form");
});

test("registration and medical forms pass axe", async ({ browser }) => {
  const r = await (await browser.newContext()).newPage();
  await joinStation(r, "111111", "Tobi");
  await r.getByRole("button", { name: /New person/ }).click();
  await r.getByText("Scan blank card").waitFor();
  await r.getByRole("button", { name: "Type card code" }).last().click();
  for (const d of "0390") await r.getByRole("button", { name: d, exact: true }).click();
  await r.getByRole("button", { name: /^Use/ }).click();
  await audit(r, "registration details");

  const m = await (await browser.newContext()).newPage();
  await joinStation(m, "444444", "Dr Amina", { rolePin: "404040" });
  await openByCode(m, "TR26-0020");
  await m.getByRole("button", { name: /Record Medical|Already served/ }).click();
  if (await m.getByRole("button", { name: "Record again" }).isVisible().catch(() => false)) await m.getByRole("button", { name: "Record again" }).click();
  await m.getByLabel(/BP systolic/).fill("170");
  await audit(m, "medical form");
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
  const scan = page.getByRole("button", { name: "Scan card" });
  await expect(scan).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
