import { expect, test, type Page } from '@playwright/test';
import { ADMIN_BASE_URL } from '../playwright.config';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/credentials';
import { signInAsAdmin } from '../helpers/users-directory';

async function assertSignedOut(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'משתמשים' })).toHaveCount(0);
}

async function logoutFromSidebar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'התנתקות' }).click();
  await assertSignedOut(page);
}

test.describe('Admin logout (KAN-116)', () => {
  test.describe.configure({ mode: 'serial' });
  test('Journey A: sidebar logout stays on sign-in through wait, reload, and catalog visit', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsAdmin(page);
    await logoutFromSidebar(page);

    await page.waitForTimeout(10_000);
    await assertSignedOut(page);

    await page.reload();
    await assertSignedOut(page);

    await page.goto(`${ADMIN_BASE_URL}/admin/users`);
    await assertSignedOut(page);
  });

  test('Journey B: after sidebar logout, invalid credentials stay out and valid credentials admit again', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await signInAsAdmin(page);
    await logoutFromSidebar(page);

    await page.getByLabel('אימייל').fill(ADMIN_EMAIL);
    await page.getByLabel('סיסמה', { exact: true }).fill('WrongPassword1!');
    await page.getByRole('button', { name: 'התחבר למערכת' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('שם המשתמש או הסיסמה שהוזנו אינם נכונים.')).toBeVisible();

    await page.getByLabel('סיסמה', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'התחבר למערכת' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'משתמשים' })).toBeVisible({ timeout: 30_000 });
  });

  test('Journey C: remember-me does not restore the session after explicit logout', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto(`${ADMIN_BASE_URL}/login`);
    await expect(page.getByLabel('אימייל')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('זכור אותי').check();
    await page.getByLabel('אימייל').fill(ADMIN_EMAIL);
    await page.getByLabel('סיסמה', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'התחבר למערכת' }).click();
    await expect(page.getByRole('heading', { name: 'משתמשים' })).toBeVisible({ timeout: 30_000 });

    await logoutFromSidebar(page);

    await page.reload();
    await assertSignedOut(page);

    await page.goto(`${ADMIN_BASE_URL}/admin/users`);
    await assertSignedOut(page);
  });
});
