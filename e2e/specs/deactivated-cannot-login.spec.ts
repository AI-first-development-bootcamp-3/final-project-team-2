import { expect, test } from '@playwright/test';
import { CREATED_EMPLOYEE_PASSWORD } from '../helpers/credentials';
import { uniqueEmail } from '../helpers/unique-email';
import { createEmployeeViaUsers, signInAsAdmin } from '../helpers/users-directory';

test.describe.skip('Deactivated cannot login', () => {
  test('a deactivated employee is refused at employee-app sign-in', async ({ page }) => {
    test.setTimeout(180_000);

    const email = uniqueEmail();
    const fullName = `E2E ${email.replace('@abra.co', '')}`;

    await signInAsAdmin(page);
    const row = await createEmployeeViaUsers(page, {
      fullName,
      email,
      password: CREATED_EMPLOYEE_PASSWORD,
    });

    await row.getByRole('button', { name: 'השבת' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'השבתת משתמש' });
    await expect(confirm.getByRole('heading', { name: 'השבתת משתמש' })).toBeVisible();
    await confirm.getByRole('button', { name: 'השבת משתמש' }).click();
    await expect(page.getByRole('status')).toContainText('המשתמש הושבת בהצלחה');

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeVisible();
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה', { exact: true }).fill(CREATED_EMPLOYEE_PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('שם המשתמש או הסיסמה שהוזנו אינם נכונים.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'דיווח שעות' })).toHaveCount(0);
  });
});
