import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';
import {
  ASSIGNED_PROJECT,
  ASSIGNED_TASK,
  LOCKED_MONTH_DATE,
  UNASSIGNED_SEED_TASK,
} from '../fixtures/daily-reporting';
import { employeeAccessToken, fetchMyAssignments, signInAsEmployee } from '../helpers/employee-app';
import { formTimesToUtc } from '../helpers/jerusalem-time';

test.use({ viewport: { width: 393, height: 852 } });

const RUN_MINUTE = String((process.pid + Date.now()) % 50).padStart(2, '0');
const START = `14:${RUN_MINUTE}`;
const END = `15:${RUN_MINUTE}`;
const EDITED_END = `16:${RUN_MINUTE}`;
const DESCRIPTION = `e2e-daily-${Date.now()}`;
const EDITED_DESCRIPTION = `${DESCRIPTION}-edited`;

async function pickAssignedWork(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'פרויקט' }).click();
  const projectSheet = page.getByRole('dialog', { name: 'בחר פרויקט' });
  await expect(projectSheet).toBeVisible();
  await projectSheet.getByRole('radio', { name: ASSIGNED_PROJECT }).click();
  await projectSheet.getByRole('button', { name: 'אישור' }).click();

  await page.getByRole('button', { name: 'משימה' }).click();
  const taskSheet = page.getByRole('dialog', { name: 'בחר משימה' });
  await expect(taskSheet).toBeVisible();
  await expect(taskSheet.getByRole('radio', { name: UNASSIGNED_SEED_TASK })).toHaveCount(0);
  await taskSheet.getByRole('radio', { name: ASSIGNED_TASK }).click();
  await taskSheet.getByRole('button', { name: 'אישור' }).click();
}

async function fillTimesAndOffice(
  page: Page,
  start: string,
  end: string,
  description: string,
): Promise<void> {
  await page.getByLabel('שעת התחלה').fill(start);
  await page.getByLabel('שעת סיום').fill(end);
  await page.locator('label').filter({ hasText: 'משרד' }).click();
  await page.getByLabel('תיאור').fill(description);
}

async function assignedTaskId(request: APIRequestContext, token: string): Promise<string> {
  const assignments = await fetchMyAssignments(request, token);
  const match = assignments.find((row) => row.taskName === ASSIGNED_TASK);
  if (!match) {
    throw new Error(`Seeded employee has no assignment named ${ASSIGNED_TASK}.`);
  }
  return match.taskId;
}

type ApiErrorBody = {
  details?: { field?: string; rule?: string }[];
};

async function createEntryViaApi(
  request: APIRequestContext,
  token: string,
  params: { taskId: string; date: string; start: string; end: string; description?: string },
) {
  const times = formTimesToUtc(params.date, params.start, params.end);
  return request.post(`${API_BASE_URL}/time-entries`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      taskId: params.taskId,
      date: times.date,
      startAt: times.startAt,
      endAt: times.endAt,
      location: 'office',
      ...(params.description ? { description: params.description } : {}),
    },
  });
}

test.describe('Daily reporting (KAN-75)', () => {
  test.describe.configure({ mode: 'serial' });

  test('seeded employee creates an entry through the picker and the quota bar updates', async ({
    page,
  }) => {
    await signInAsEmployee(page);

    await page.getByRole('link', { name: 'דיווח ידני' }).click();
    await expect(page.getByRole('heading', { name: 'דיווח ידני' })).toBeVisible();

    await pickAssignedWork(page);
    await fillTimesAndOffice(page, START, END, DESCRIPTION);
    await page.getByRole('button', { name: 'שמירה' }).click();

    await expect(page).toHaveURL(new URL('/', page.url()).href);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    await expect(page.getByText(ASSIGNED_TASK)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '1 מתוך 9 שעות' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '1 מתוך 9 שעות' })).toHaveAttribute(
      'data-status',
      'partial',
    );
  });

  test('the unassigned seed task never appears in the picker', async ({ page }) => {
    await signInAsEmployee(page);
    await page.getByRole('link', { name: 'דיווח ידני' }).click();

    await page.getByRole('button', { name: 'פרויקט' }).click();
    const projectSheet = page.getByRole('dialog', { name: 'בחר פרויקט' });
    await expect(projectSheet.getByRole('radio', { name: UNASSIGNED_SEED_TASK })).toHaveCount(0);
    await projectSheet.getByRole('radio', { name: ASSIGNED_PROJECT }).click();
    await projectSheet.getByRole('button', { name: 'אישור' }).click();

    await page.getByRole('button', { name: 'משימה' }).click();
    const taskSheet = page.getByRole('dialog', { name: 'בחר משימה' });
    await expect(taskSheet.getByRole('radio', { name: UNASSIGNED_SEED_TASK })).toHaveCount(0);
    await expect(taskSheet.getByRole('radio', { name: ASSIGNED_TASK })).toBeVisible();
  });

  test('an edit and a delete both round-trip', async ({ page }) => {
    await signInAsEmployee(page);

    const row = page.locator('li').filter({ hasText: DESCRIPTION });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'עריכה' }).click();

    await expect(page.getByRole('heading', { name: 'דיווח ידני' })).toBeVisible();
    await expect(page.getByLabel('תיאור')).toHaveValue(DESCRIPTION, { timeout: 15_000 });
    await page.getByLabel('שעת סיום').fill(EDITED_END);
    await page.getByLabel('תיאור').fill(EDITED_DESCRIPTION);
    await page.getByRole('button', { name: 'שמירה' }).click();

    await expect(page).toHaveURL(new URL('/', page.url()).href);
    await expect(page.getByText(EDITED_DESCRIPTION)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '2 מתוך 9 שעות' })).toBeVisible();

    const edited = page.locator('li').filter({ hasText: EDITED_DESCRIPTION });
    await edited.getByRole('button', { name: 'מחיקה' }).click();
    const confirm = page.getByRole('dialog', { name: 'אישור מחיקה' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'מחיקה' }).click();

    await expect(page.getByText(EDITED_DESCRIPTION)).toHaveCount(0);
    await expect(page.getByText('אין דיווחי שעות להיום')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '0 מתוך 9 שעות' })).toBeVisible();
  });

  test('a write into the locked month is refused with 403 and the form shows locked', async ({
    page,
    request,
  }) => {
    const token = await employeeAccessToken(request);
    const taskId = await assignedTaskId(request, token);
    const forbidden = await createEntryViaApi(request, token, {
      taskId,
      date: LOCKED_MONTH_DATE,
      start: '10:00',
      end: '11:00',
      description: 'locked-month-probe',
    });
    expect(forbidden.status()).toBe(403);
    const body = (await forbidden.json()) as ApiErrorBody;
    expect(body.details?.some((detail) => detail.rule === 'VAL-34')).toBe(true);

    await signInAsEmployee(page);
    await page.goto(`/entry/new?date=${LOCKED_MONTH_DATE}`);
    await expect(page.getByRole('heading', { name: 'דיווח ידני' })).toBeVisible();

    await pickAssignedWork(page);
    await fillTimesAndOffice(page, '10:00', '11:00', 'locked-month-ui');
    await page.getByRole('button', { name: 'שמירה' }).click();

    await expect(page.getByRole('status')).toHaveText('החודש נעול');
    await expect(page.getByRole('alert')).toContainText('החודש נעול');
    await expect(page.getByRole('button', { name: 'שמירה' })).toHaveCount(0);
  });

  test('a deleted entry does not block re-reporting the same slot', async ({ request }) => {
    const token = await employeeAccessToken(request);
    const taskId = await assignedTaskId(request, token);
    const date = '2026-03-10';
    const created = await createEntryViaApi(request, token, {
      taskId,
      date,
      start: '10:00',
      end: '11:00',
      description: 'soft-delete-overlap',
    });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()) as { data?: { id?: string } };
    const id = createdBody.data?.id;
    expect(id).toBeTruthy();

    const deleted = await request.delete(`${API_BASE_URL}/time-entries/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleted.status()).toBe(204);

    const again = await createEntryViaApi(request, token, {
      taskId,
      date,
      start: '10:00',
      end: '11:00',
      description: 'soft-delete-overlap-retry',
    });
    expect(again.status()).toBe(201);
    const againBody = (await again.json()) as ApiErrorBody;
    expect(againBody.details?.some((detail) => detail.rule === 'VAL-32')).toBeFalsy();
  });

  test('concurrent writes for the same slot accept one and answer VAL-32 for the other', async ({
    request,
  }) => {
    const token = await employeeAccessToken(request);
    const taskId = await assignedTaskId(request, token);
    const payload = {
      taskId,
      date: '2026-03-11',
      start: '10:00',
      end: '11:00',
      description: 'concurrent-overlap',
    };

    const [first, second] = await Promise.all([
      createEntryViaApi(request, token, payload),
      createEntryViaApi(request, token, payload),
    ]);

    const statuses = [first.status(), second.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const rejected = first.status() === 409 ? first : second;
    const rejectedBody = (await rejected.json()) as ApiErrorBody;
    expect(rejectedBody.details?.some((detail) => detail.rule === 'VAL-32')).toBe(true);
  });
});
