import { defineConfig, devices } from "@playwright/test";

// Uçtan uca testler: API (NODE_ENV=test) 8080'de, site 3000'de çalışırken koşar.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"] } },
    { name: "telefon", use: { ...devices["Pixel 7"] } },
  ],
});
