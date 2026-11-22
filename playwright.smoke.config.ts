import { defineConfig, devices } from "@playwright/test";

// Smoke test against a deployed site (no local server):
//   SMOKE_URL=https://gratitudeoutreach.vercel.app SMOKE_ADMIN_EMAIL=… SMOKE_ADMIN_PASSWORD=… pnpm smoke
// Uses the Training 2026 edition and its documented PINs, so no real data is touched.
export default defineConfig({
  testDir: "tests/smoke",
  timeout: 120_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.SMOKE_URL ?? "https://gratitudeoutreach.vercel.app", ...devices["Pixel 7"], trace: "retain-on-failure" },
});
