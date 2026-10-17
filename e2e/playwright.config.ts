import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests.
 *
 * Runs its own API (port 3100) and web app (port 5174) against the disposable test database,
 * so it never touches development data or a dev server that is already running.
 */
const API_PORT = 3100;
const WEB_PORT = 5174;
const DB_NAME = process.env.DB_TEST_NAME ?? 'vacation_manager_test';

export default defineConfig({
  testDir: './tests',
  // One shared database: run serially for deterministic data.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional: point at a pre-installed Chromium instead of `npx playwright install chromium`.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      // Data-changing flows run once (desktop); every screen is still audited on mobile.
      testMatch: ['accessibility.spec.ts', 'planner.spec.ts'],
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: { PORT: String(API_PORT), DB_NAME, LOG_LEVEL: 'warn' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -w frontend -- --port ${WEB_PORT}`,
      cwd: '..',
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
