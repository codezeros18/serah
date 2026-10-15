import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "./node_modules/.cache/playwright-results",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "hp", use: { ...devices["Pixel 5"] } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: "node ../../scripts/next.mjs dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
