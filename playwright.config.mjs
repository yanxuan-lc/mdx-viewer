import { defineConfig } from "@playwright/test";

const port = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [["list"], ["json", { outputFile: "test-results/playwright.json" }], ["junit", { outputFile: "test-results/playwright.xml" }]] : "list",
  use: { baseURL: `http://localhost:${port}`, headless: true, trace: "retain-on-failure" },
  webServer: [
    {
      command: `node bin/mdxv.mjs e2e/fixtures --no-open --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/empty-state-server.mjs directory zh-CN 4184",
      url: "http://localhost:4184",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/empty-state-server.mjs directory en-US 4185",
      url: "http://localhost:4185",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/empty-state-server.mjs select zh-CN 4186",
      url: "http://localhost:4186",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node e2e/empty-state-server.mjs select en-US 4187",
      url: "http://localhost:4187",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
