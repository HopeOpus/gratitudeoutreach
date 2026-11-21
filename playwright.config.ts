import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Pixel 7"],
    permissions: ["camera"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
    trace: "retain-on-failure",
  },
  // Requires `supabase start` (seeded) and `pnpm build` first.
  webServer: { command: `pnpm start -p ${PORT}`, url: `http://127.0.0.1:${PORT}/join`, reuseExistingServer: true, timeout: 120_000 },
});
