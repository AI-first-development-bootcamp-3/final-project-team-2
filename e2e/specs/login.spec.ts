import { test, expect, type Page } from '@playwright/test';
import { SEEDED_EMPLOYEE } from '../fixtures/users';

async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill(password);
  await page.getByRole('button', { name: 'התחבר' }).click();
}

test.describe('Login flow (KAN-42)', () => {
  test('seeded employee logs in with valid credentials and lands on the daily report home', async ({
    page,
  }) => {
    await fillLoginForm(page, SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);

    // Exact path — /\/$/ would also match /login/ and every other
    // trailing-slash URL.
    await expect(page).toHaveURL(new URL('/', page.url()).href);
    await expect(page.getByRole('heading', { name: 'עמוד ראשי - דיווח יומי' })).toBeVisible();
  });

  test('wrong password shows the Hebrew error and stays on the login screen', async ({ page }) => {
    await fillLoginForm(page, SEEDED_EMPLOYEE.email, 'WrongPassword1!');

    await expect(page.getByText('שם המשתמש או הסיסמה שהוזנו אינם נכונים.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'עמוד ראשי - דיווח יומי' })).not.toBeVisible();
  });
});
