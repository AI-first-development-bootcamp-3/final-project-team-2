import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';

export type PickerAssignment = {
  clientName: string;
  projectName: string;
  taskName: string;
};

async function searchAndFindRow(
  page: Page,
  uniqueText: string,
  pathIncludes: string,
): Promise<Locator> {
  const pending = page.waitForResponse((res) => {
    const url = res.url();
    return (
      url.includes(pathIncludes) && url.includes(`q=${encodeURIComponent(uniqueText)}`) && res.ok()
    );
  });
  await page.getByLabel('חיפוש').fill(uniqueText);
  await pending;
  const row = page.getByRole('row').filter({ hasText: uniqueText });
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
}

export async function createClientViaConsole(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'לקוח חדש' }).click();
  const dialog = page.getByRole('dialog', { name: 'לקוח חדש' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('שם לקוח').fill(name);
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('הלקוח נוצר בהצלחה');

  const row = await searchAndFindRow(page, name, '/clients?');
  await expect(row).toContainText('פעיל');
}

export async function createProjectViaConsole(
  page: Page,
  params: { name: string; clientName: string },
): Promise<void> {
  await page.getByRole('button', { name: 'פרויקט חדש' }).click();
  const dialog = page.getByRole('dialog', { name: 'יצירת פרויקט' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('שם הפרויקט').fill(params.name);
  await expect(dialog.getByLabel('שם הלקוח')).toContainText(params.clientName, { timeout: 15_000 });
  await dialog.getByLabel('שם הלקוח').selectOption({ label: params.clientName });
  await dialog.getByRole('button', { name: 'צור פרויקט' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('הפרויקט נוצר בהצלחה');

  const row = await searchAndFindRow(page, params.name, '/projects?');
  await expect(row).toContainText(params.clientName);
  await expect(row).toContainText('פעיל');
}

export async function createTaskViaConsole(
  page: Page,
  params: { name: string; projectName: string; clientName: string },
): Promise<void> {
  await page.getByRole('button', { name: 'משימה חדשה' }).click();
  const dialog = page.getByRole('dialog', { name: 'משימה חדשה' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('שם משימה').fill(params.name);
  const projectLabel = `${params.projectName} (${params.clientName})`;
  await expect(dialog.getByLabel('פרויקט')).toContainText(projectLabel, { timeout: 15_000 });
  await dialog.getByLabel('פרויקט').selectOption({ label: projectLabel });
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('המשימה נוצרה בהצלחה');

  const row = await searchAndFindRow(page, params.name, '/tasks?');
  await expect(row).toContainText(params.projectName);
  await expect(row).toContainText('פתוחה');
}

export async function assignEmployeeViaConsole(
  page: Page,
  params: {
    fullName: string;
    email: string;
    taskName: string;
    projectName: string;
    clientName: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'שיוך חדש' }).click();
  const dialog = page.getByRole('dialog', { name: 'שיוך חדש' });
  await expect(dialog).toBeVisible();
  const employeeLabel = `${params.fullName} (${params.email})`;
  const taskLabel = `${params.taskName} (${params.projectName} - ${params.clientName})`;
  await expect(dialog.getByLabel('עובד')).toContainText(employeeLabel, { timeout: 15_000 });
  await dialog.getByLabel('עובד').selectOption({ label: employeeLabel });
  await expect(dialog.getByLabel('משימה')).toContainText(taskLabel, { timeout: 15_000 });
  await dialog.getByLabel('משימה').selectOption({ label: taskLabel });
  await dialog.getByRole('button', { name: 'שמירה' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('השיוך נוצר בהצלחה');

  const row = await searchAndFindRow(page, params.email, '/assignments?');
  await expect(row).toContainText(params.fullName);
  await expect(row).toContainText(params.taskName);
}

export async function fetchMyAssignments(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ status: number; data: PickerAssignment[] }> {
  const login = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
  });
  if (!login.ok()) {
    throw new Error(
      `Setup: employee ${email} could not sign in (HTTP ${login.status()}). ` +
        'The dedicated employee must exist and be able to log in before picker assertions.',
    );
  }
  const loginBody = (await login.json()) as { accessToken?: string };
  if (!loginBody.accessToken) {
    throw new Error(`Setup: employee ${email} login succeeded but no accessToken was returned.`);
  }

  const response = await request.get(`${API_BASE_URL}/me/assignments`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  const body = (await response.json()) as { data?: PickerAssignment[] };
  return { status: response.status(), data: body.data ?? [] };
}
