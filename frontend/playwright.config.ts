import { defineConfig, devices } from "@playwright/test";

/**
 * BASE_URL controls where Playwright points:
 *  - http://documind.packt.localhost  → test through nginx (frontend on :8990)
 *  - http://localhost:8990             → test directly against Next.js dev server
 *  - (default)                         → start next start on :8991 and test there
 */
const BASE_URL = process.env.BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,

  use: {
    baseURL: BASE_URL || "http://localhost:8991",
    trace: "on-first-retry",
  },

  // Only spin up a local Next.js instance when no external BASE_URL is given
  webServer:
    BASE_URL || process.env.CI
      ? undefined
      : {
          command: "npx next start -p 8991",
          url: "http://localhost:8991",
          reuseExistingServer: true,
          timeout: 60_000,
        },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
