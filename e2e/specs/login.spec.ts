import { test, expect } from '@playwright/test';

// Seeded by server/api/prisma/seed.ts
const EMPLOYEE_EMAIL = 'employee1@abra.co';
const EMPLOYEE_PASSWORD = 'Employee123!';

test.describe('Login flow (KAN-42)', () => {
  test('seeded employee logs in with valid credentials and lands on the daily report home', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('אימייל').fill(EMPLOYEE_EMAIL);
    await page.getByLabel('סיסמה').fill(EMPLOYEE_PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'עמוד ראשי - דיווח יומי' })).toBeVisible();
  });
});
