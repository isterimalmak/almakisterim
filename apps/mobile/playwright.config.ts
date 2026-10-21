import { defineConfig, devices } from "@playwright/test";

// Uygulamanın tarayıcı sürümüyle uçtan uca test: API (NODE_ENV=test) 8080'de çalışırken koşar.
// Önce: EXPO_PUBLIC_API_URL=http://localhost:8090 npm run export:web
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8090",
    ...devices["Pixel 7"],
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: "node e2e/serve.mjs", url: "http://localhost:8090", reuseExistingServer: true },
});
