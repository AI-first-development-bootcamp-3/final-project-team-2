import { test, expect } from '@playwright/test';

test.describe('Employee app shell', () => {
  test('renders the app with correct title', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await expect(page).toHaveTitle('Abra Timesheet');

    const heading = page.getByRole('heading', { name: 'Abra Timesheet' });
    await expect(heading).toBeVisible();
  });
});
