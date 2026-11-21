import { test, expect } from "@playwright/test";
import { adminLogin, rest, TRAINING_EDITION } from "./helpers";

test("coordinator exports services as CSV/XLSX without confidential content, and it is audit-logged", async ({ page }) => {
  await adminLogin(page);
  const before = await rest<unknown[]>(`audit_log?action=eq.export&select=id`);
  const csv = await page.request.get(`/api/exports/services?edition=${TRAINING_EDITION}&format=csv`);
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text.split("\n")[0]).toContain("Time,Station,Card,Name,Served by,Summary");
  expect(text).not.toContain("Training note");
  expect(text).not.toContain("Training impression");

  const xlsx = await page.request.get(`/api/exports/beneficiaries?edition=${TRAINING_EDITION}&format=xlsx`);
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  const after = await rest<unknown[]>(`audit_log?action=eq.export&select=id`);
  expect(after.length).toBe(before.length + 2);
});

test("viewers cannot export", async ({ page }) => {
  await adminLogin(page, "viewer@gratitude.test");
  const r = await page.request.get(`/api/exports/services?edition=${TRAINING_EDITION}&format=csv`);
  expect(r.status()).toBe(403);
});

test("print PDFs render: cards (85×55 mm), posters with join-QR, summary report", async ({ page }) => {
  await adminLogin(page);
  for (const url of [`/api/cards/pdf?edition=${TRAINING_EDITION}&batch=1&layout=a4-10`, `/api/posters/pdf?edition=${TRAINING_EDITION}`, `/api/reports/summary?edition=${TRAINING_EDITION}`]) {
    const r = await page.request.get(url);
    expect(r.status(), url).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    const body = await r.body();
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
  }
});
