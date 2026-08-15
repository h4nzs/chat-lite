import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Batasi worker: server dev lokal + Postgres/Redis bersama mudah contention
  // bila 6+ browser jalan bersamaan (flaky pada spec profile/chat).
  workers: 2,
  globalSetup: './e2e/global.setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter nyx-server dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter nyx-web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
  ],
});
