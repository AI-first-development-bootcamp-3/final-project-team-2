import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';
import { CREATED_EMPLOYEE_PASSWORD } from '../helpers/credentials';
import { uniqueEmail } from '../helpers/unique-email';
import { uniqueName } from '../helpers/unique-name';
import {
  assignEmployeeViaConsole,
  createClientViaConsole,
  createProjectViaConsole,
  createTaskViaConsole,
} from '../helpers/catalog-chain';
import { createEmployeeViaUsers, signInAsAdmin, signOutAdmin } from '../helpers/users-directory';

/**
 * KAN-84 — the monthly view proves its day statuses and drill-down against a
 * seeded month.
 *
 * Deliberately absent until their prerequisites merge:
 * - the absence-day status (no absence API exists yet — Epic 7; covered at
 *   component level against fixture absences),
 * - the locked-month read-only case (no lock-write endpoint exists yet —
 *   Epic 9's e2e locks a month for real; covered at component level),
 * - the edit round-trip (the entry edit form is KAN-73, still in review —
 *   task 4.2 of the monthly-view change wires and tests it).
 */

function day(dayOfMonth: number): { date: string; iso: (hour: number) => string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = `${year}-${month}-${String(dayOfMonth).padStart(2, '0')}`;
  return {
    date,
    iso: (hour: number) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  };
}

async function loginViaApi(request: APIRequestContext, email: string): Promise<{ token: string }> {
  const login = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password: CREATED_EMPLOYEE_PASSWORD },
  });
  expect(login.ok(), `employee ${email} must be able to sign in`).toBe(true);
  const body = (await login.json()) as { accessToken: string };
  return { token: body.accessToken };
}

async function firstAssignedTaskId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${API_BASE_URL}/me/assignments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: Array<{ taskId: string }> };
  const first = body.data[0];
  if (first === undefined) {
    throw new Error('Setup: the seeded employee has no assignments to report against.');
  }
  return first.taskId;
}

async function reportHours(
  request: APIRequestContext,
  token: string,
  taskId: string,
  entry: { date: string; startAt: string; endAt: string },
): Promise<void> {
  const res = await request.post(`${API_BASE_URL}/time-entries`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { taskId, location: 'office', ...entry },
  });
  expect(res.status(), `seeding entry on ${entry.date}`).toBe(201);
}

test.describe('Monthly view', () => {
  test('renders seeded day statuses and drills into a day', async ({ page, request }) => {
    test.setTimeout(240_000);

    const email = uniqueEmail();
    const fullName = `E2E ${email.replace('@abra.co', '')}`;
    const clientName = uniqueName('לקוח');
    const projectName = uniqueName('פרויקט');
    const taskName = uniqueName('משימה');

    // Seed the catalog chain and the employee through the admin console.
    await signInAsAdmin(page);
    await createEmployeeViaUsers(page, { fullName, email, password: CREATED_EMPLOYEE_PASSWORD });

    await page.getByRole('link', { name: 'לקוחות' }).click();
    await expect(page.getByRole('heading', { name: 'לקוחות' })).toBeVisible();
    await createClientViaConsole(page, clientName);

    await page.getByRole('link', { name: 'פרויקטים' }).click();
    await expect(page.getByRole('heading', { name: 'פרויקטים' })).toBeVisible();
    await createProjectViaConsole(page, { name: projectName, clientName });

    await page.getByRole('link', { name: 'משימות' }).click();
    await expect(page.getByRole('heading', { name: 'משימות' })).toBeVisible();
    await createTaskViaConsole(page, { name: taskName, projectName, clientName });

    await page.getByRole('link', { name: 'שיוכים' }).click();
    await expect(page.getByRole('heading', { name: 'שיוכים' })).toBeVisible();
    await assignEmployeeViaConsole(page, { fullName, email, taskName, projectName, clientName });

    await signOutAdmin(page);

    // Report a full (9h), an excess (10h), and a partial (4h) day via the API.
    const { token } = await loginViaApi(request, email);
    const taskId = await firstAssignedTaskId(request, token);
    const full = day(3);
    const excess = day(4);
    const partial = day(5);
    await reportHours(request, token, taskId, {
      date: full.date,
      startAt: full.iso(5),
      endAt: full.iso(14),
    });
    await reportHours(request, token, taskId, {
      date: excess.date,
      startAt: excess.iso(5),
      endAt: excess.iso(15),
    });
    await reportHours(request, token, taskId, {
      date: partial.date,
      startAt: partial.iso(5),
      endAt: partial.iso(9),
    });

    // Sign into the employee app and open the monthly view.
    await page.goto('/login');
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill(CREATED_EMPLOYEE_PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('/monthly');
    await expect(page.getByRole('grid')).toBeVisible();

    // The seeded statuses, straight off the calendar cells.
    await expect(page.getByTestId(`day-${full.date}`)).toHaveAttribute('data-status', 'full');
    await expect(page.getByTestId(`day-${excess.date}`)).toHaveAttribute('data-status', 'excess');
    await expect(page.getByTestId(`day-${partial.date}`)).toHaveAttribute('data-status', 'partial');

    // Drill-down lists the day's entry with its task chain.
    await page.getByTestId(`day-${full.date}`).click();
    const detail = page.getByRole('region', { name: new RegExp(full.date) });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('9 שעות');
    await expect(detail).toContainText(taskName);
    await expect(detail).toContainText(projectName);
    await expect(detail).toContainText(clientName);
  });
});
