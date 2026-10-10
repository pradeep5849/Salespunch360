import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  reporter: "line",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "1"
        ? "npm run start -- --hostname 127.0.0.1"
        : "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/sign-in",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
