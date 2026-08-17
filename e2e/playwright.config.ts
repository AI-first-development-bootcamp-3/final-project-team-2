import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

const MOBILE_PORT = +(process.env.MOBILE_PORT || 5173);
const API_PORT = +(process.env.API_PORT || 3000);

export const API_BASE_URL = `http://localhost:${API_PORT}/api/v1`;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html']] : 'html',

  use: {
    baseURL: `http://localhost:${MOBILE_PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @abra/contracts build && pnpm --filter @abra/mobile dev',
      port: MOBILE_PORT,
      reuseExistingServer: !isCI,
      cwd: '..',
    },
    {
      command: isCI
        ? 'pnpm --filter @abra/api build && pnpm --filter @abra/api start'
        : 'pnpm --filter @abra/api dev',
      port: API_PORT,
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '..',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/abra_test',
      },
    },
  ],
});
