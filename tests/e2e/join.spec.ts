import { test, expect } from "@playwright/test";
import { joinStation } from "./helpers";

test("volunteer joins with a PIN, no email or password", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Station PIN").fill("000000");
  await expect(page.getByText("That PIN doesn't match a station")).toBeVisible();

  await joinStation(page, "555555", "Kunle");
  await expect(page.getByRole("heading", { name: "Food" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
  await expect(page.getByText("TRAINING")).toBeVisible();
});

test("confidential stations need the role PIN and agreement", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Station PIN").fill("444444");
  await page.getByLabel(/First name/).fill("Amina");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/You.ll see private medical notes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start serving" })).toBeDisabled();
});
