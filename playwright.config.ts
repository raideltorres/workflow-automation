import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);
const API_PORT = 3100;
const WEB_PORT = 4300;

export default defineConfig({
  testDir: './e2e',
  // One backend and one database are shared by every test, so scenarios run serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start:e2e -w @workflow/api',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_URL: `http://localhost:${WEB_PORT}` },
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: `npm run start:e2e -w @workflow/web -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
