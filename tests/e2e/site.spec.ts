import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [path, title] of [["/", "Cause a Smile Initiative"], ["/gratitudeoutreach", "Gratitude Outreach · Cause a Smile Initiative"]]) {
  test(`${path} is public, accessible and fits every width`, async ({ page }) => {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    }
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect((await page.request.get(new URL(og!).pathname)).status()).toBe(200);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("the app keeps its addresses, manifest and noindex", async ({ page }) => {
  await page.goto("/gratitudeoutreach/join");
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  expect((await (await page.request.get("/manifest.webmanifest")).json()).start_url).toBe("/s");
  await page.goto("/gratitudeoutreach/team");
  await expect(page.getByRole("link", { name: "Join a station" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("public pages load with the service worker, and the team page works offline", async ({ page, context }) => {
  await page.goto("/join");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("smile");
  await context.setOffline(true);
  await page.goto("/gratitudeoutreach/team");
  await expect(page.getByRole("link", { name: "Join a station" })).toBeVisible();
});
