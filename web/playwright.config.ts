import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // workers: 1 (serial) — suite berbagi 1 server dev + Postgres/Redis lokal;
  // spec profile/settings flaky bila >1 browser berjalan bersamaan (timing event
  // `user:updated` & profil REST). Serial = deterministik untuk CI.
  workers: 1,
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
    {
      // Chrome penuh (channel apt) — satu-satunya varian yang mendukung
      // WebTransport/QUIC di CI. Dipakai oleh job `e2e-chrome`.
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
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
