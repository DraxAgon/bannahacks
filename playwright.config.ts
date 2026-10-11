import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  use: {
    baseURL,
    // In sandboxes with a preinstalled Chromium, point PW_CHROMIUM at it.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npx next start -p ${port}`, url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 60_000 },
});
