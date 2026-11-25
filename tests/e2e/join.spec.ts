import { test, expect } from "@playwright/test";
import { joinStation, signInVolunteer, testPhone } from "./helpers";

test("volunteer registers with a station PIN, name and phone", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill("000000");
  await expect(page.getByText("That PIN doesn't match a station")).toBeVisible();

  await joinStation(page, "555555", "Kunle");
  await expect(page.getByRole("heading", { name: "Food" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
  await expect(page.getByText("TRAINING")).toBeVisible();
});

test("registering needs a phone number", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill("555555");
  await page.getByLabel(/^Name/).fill("Kunle");
  await page.getByRole("button", { name: "Register and start" }).click();
  await expect(page.getByText("Enter your phone number")).toBeVisible();
});

test("one account signs in on several phones; a wrong phone is not found", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const phone = await joinStation(a, "555555", "Grace Ade");

  const b = await (await browser.newContext()).newPage();
  await b.goto("/join");
  await b.getByLabel(/^Name/).fill("Grace Ade");
  await b.getByLabel(/^Phone number/).fill(testPhone());
  await b.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(b.getByText("Account not found. Check your name and phone number, or register.")).toBeVisible();
  await expect(b.getByRole("button", { name: "Register" }).first()).toBeVisible();

  await signInVolunteer(b, "grace ade", phone);
  await expect(b.getByRole("heading", { name: "Food" })).toBeVisible();

  // The first phone is still signed in.
  await a.reload();
  await expect(a.getByRole("navigation", { name: "Station" })).toBeVisible();
  await expect(a.getByRole("heading", { name: "Food" })).toBeVisible();
});

test("confidential stations need the role PIN and agreement", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("radio", { name: "Register" }).click();
  await page.getByLabel("Station PIN").fill("444444");
  await page.getByLabel(/^Name/).fill("Amina");
  await page.getByLabel(/^Phone number/).fill(testPhone());
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/You.ll see private medical notes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start serving" })).toBeDisabled();
});

test("signing in to a confidential station asks for the role PIN again", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const phone = await joinStation(a, "444444", "Dr Ifeoma", { rolePin: "404040" });
  const b = await (await browser.newContext()).newPage();
  await signInVolunteer(b, "Dr Ifeoma", phone, { rolePin: "404040" });
  await expect(b.getByRole("heading", { name: "General Doctor" })).toBeVisible();
});
