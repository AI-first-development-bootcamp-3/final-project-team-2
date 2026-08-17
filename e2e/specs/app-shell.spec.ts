import { test, expect } from '@playwright/test';

test.describe('Employee app shell', () => {
  test('renders the login app shell by default for unauthenticated visitors', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Abra Timesheet');
    await expect(page).toHaveURL(/.*login/);

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('ברוכים הבאים');
  });
});
