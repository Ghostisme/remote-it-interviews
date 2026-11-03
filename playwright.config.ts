import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 12000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 1440, height: 1050 },
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev:backend",
      url: "http://localhost:8787/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      command: "pnpm dev:dashboard",
      url: "http://localhost:8081",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
