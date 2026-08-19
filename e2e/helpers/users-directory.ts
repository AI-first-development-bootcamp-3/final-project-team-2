import { expect, type Locator, type Page } from '@playwright/test';
import { ADMIN_BASE_URL } from '../playwright.config';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CREATED_EMPLOYEE_PASSWORD } from './credentials';

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto(`${ADMIN_BASE_URL}/login`);
  await expect(
    page.getByLabel('אימייל'),
    'Admin sign-in form must exist (KAN-70). Seed admin is required (FR-012).',
  ).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('אימייל').fill(ADMIN_EMAIL);
  await page.getByLabel('סיסמה', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'התחבר למערכת' }).click();
  await expect(
    page.getByRole('heading', { name: 'משתמשים' }),
    'Seed admin must reach Users. Run prisma db seed (admin@abra.co).',
  ).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signOutAdmin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'התנתק' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'משתמשים' })).toHaveCount(0);
}

export async function createEmployeeViaUsers(
  page: Page,
  params: { fullName: string; email: string; password?: string },
): Promise<Locator> {
  const password = params.password ?? CREATED_EMPLOYEE_PASSWORD;

  await page.getByRole('button', { name: 'יצירת משתמש' }).click();
  const dialog = page.getByRole('dialog', { name: 'יצירת משתמש' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('שם מלא').fill(params.fullName);
  await dialog.getByLabel('אימייל').fill(params.email);
  await dialog.getByLabel('סיסמה ראשונית').fill(password);
  await dialog.getByLabel('תפקיד').selectOption({ label: 'רגיל' });
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel('חיפוש').fill(params.email);
  const row = page.getByRole('row').filter({ hasText: params.email });
  await expect(row).toBeVisible();
  await expect(row).toContainText(params.fullName);
  await expect(row).toContainText('משתמש רגיל');
  await expect(row).toContainText('פעיל');
  await expect(row).not.toContainText(password);
  return row;
}
