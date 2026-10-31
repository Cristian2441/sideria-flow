import { defineConfig, devices } from "@playwright/test";

/**
 * HU-32: Configuración de Playwright E2E.
 * Requiere que el servidor esté corriendo en http://localhost:3000
 * Ejecutar con: pnpm test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

