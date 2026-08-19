import { expect, test } from '@playwright/test';
import { CREATED_EMPLOYEE_PASSWORD } from '../helpers/credentials';
import { uniqueEmail } from '../helpers/unique-email';
import { createEmployeeViaUsers, signInAsAdmin, signOutAdmin } from '../helpers/users-directory';

test.describe.skip('Create then login', () => {
  test('admin creates an employee who can sign into the employee app', async ({ page }) => {
    test.setTimeout(180_000);

    const email = uniqueEmail();
    const fullName = `E2E ${email.replace('@abra.co', '')}`;

    await signInAsAdmin(page);
    await createEmployeeViaUsers(page, { fullName, email, password: CREATED_EMPLOYEE_PASSWORD });

    await signOutAdmin(page);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeVisible();
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill(CREATED_EMPLOYEE_PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'דיווח שעות' })).toBeVisible();
    await expect(page.getByText(/שינוי סיסמה|החלפת סיסמה|יש לשנות את הסיסמה/)).toHaveCount(0);
  });
});
