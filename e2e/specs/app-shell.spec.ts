import { test, expect } from '@playwright/test';

test.describe('Employee app shell', () => {
  test('renders the login app shell by default for unauthenticated visitors', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Abra Timesheet');

    const heading = page.getByRole('heading', { name: 'ברוכים הבאים!' });
    await expect(heading).toBeVisible();
  });
});
