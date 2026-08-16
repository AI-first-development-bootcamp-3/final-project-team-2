import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html']] : 'html',

  use: {
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
      command: 'pnpm --filter @abra/mobile dev',
      port: 5173,
      reuseExistingServer: !isCI,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @abra/api dev',
      port: 3000,
      reuseExistingServer: !isCI,
      cwd: '..',
    },
  ],
});
