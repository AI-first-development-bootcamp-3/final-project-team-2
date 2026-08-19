import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
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
import { signInAsEmployee } from '../helpers/employee-app';
import { createEmployeeViaUsers, signInAsAdmin, signOutAdmin } from '../helpers/users-directory';

/**
 * KAN-84 — the monthly view proves its day statuses, drill-down, absence
 * rendering, and locked-month read-only against seeded data.
 *
 * The locked month (2026-07) and the absence (employee2, 2026-08-13) come from
 * server/api/prisma/seed.ts — no lock-write or absence-write API exists yet
 * (Epics 9 and 7); those epics' e2e replaces the seed dependency with real
 * writes.
 */

/** Must match server/api/prisma/seed.ts and the MonthlyPage header. */
const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/** Seeded in server/api/prisma/seed.ts: employee2 has a vacation absence. */
const SEEDED_EMPLOYEE_2 = { email: 'employee2@abra.co', password: 'Employee123!' } as const;
const SEEDED_ABSENCE = { year: 2026, month: 8, date: '2026-08-13' } as const;
const SEEDED_LOCKED_MONTH = { year: 2026, month: 7 } as const;

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

/**
 * Clicks the month navigation from the current month to the requested one.
 * The monthly page has no month in its URL, so the arrows are the only way
 * there — exactly what an employee does.
 */
async function goToMonth(page: Page, year: number, month: number): Promise<void> {
  const now = new Date();
  const delta = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  const arrow = delta >= 0 ? 'החודש הקודם' : 'החודש הבא';
  for (let i = 0; i < Math.abs(delta); i += 1) {
    await page.getByRole('button', { name: arrow }).click();
  }
  await expect(
    page.getByRole('heading', { name: `${MONTH_NAMES[month - 1]} ${year}` }),
  ).toBeVisible();
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

    // Sign into the employee app and open the monthly view from home.
    await page.goto('/login');
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill(CREATED_EMPLOYEE_PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.getByRole('link', { name: 'מבט חודשי' }).click();
    await expect(page.getByRole('grid')).toBeVisible();

    // The seeded statuses, straight off the calendar cells.
    await expect(page.getByTestId(`day-${full.date}`)).toHaveAttribute('data-status', 'full');
    await expect(page.getByTestId(`day-${excess.date}`)).toHaveAttribute('data-status', 'excess');
    await expect(page.getByTestId(`day-${partial.date}`)).toHaveAttribute('data-status', 'partial');

    // Drill-down lists the day's entry with its task chain and an edit link
    // into the standard form (KAN-82).
    await page.getByTestId(`day-${full.date}`).click();
    const detail = page.getByRole('region', { name: new RegExp(full.date) });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('9 שעות');
    await expect(detail).toContainText(taskName);
    await expect(detail).toContainText(projectName);
    await expect(detail).toContainText(clientName);
    await expect(detail.getByRole('link', { name: 'עריכה' })).toHaveAttribute(
      'href',
      /\/entry\/[0-9a-f-]{36}$/,
    );

    // And back home through the monthly view's own affordance.
    await page.getByRole('link', { name: 'חזרה לדיווח יומי' }).click();
    await expect(page.getByRole('heading', { name: 'דיווח שעות' })).toBeVisible();
  });

  test('a seeded absence renders as an absence day (KAN-81)', async ({ page }) => {
    await signInAsEmployee(page, SEEDED_EMPLOYEE_2);

    await page.getByRole('link', { name: 'מבט חודשי' }).click();
    await expect(page.getByRole('grid')).toBeVisible();

    await goToMonth(page, SEEDED_ABSENCE.year, SEEDED_ABSENCE.month);

    await expect(page.getByTestId(`day-${SEEDED_ABSENCE.date}`)).toHaveAttribute(
      'data-status',
      'absence',
    );
  });

  test('the seeded locked month is read-only with the lock indicator (KAN-83)', async ({
    page,
  }) => {
    await signInAsEmployee(page);

    await page.getByRole('link', { name: 'מבט חודשי' }).click();
    await expect(page.getByRole('grid')).toBeVisible();

    await goToMonth(page, SEEDED_LOCKED_MONTH.year, SEEDED_LOCKED_MONTH.month);

    // The lock chrome: indicator naming the month plus the read-only banner.
    await expect(page.getByText('החודש נעול לעריכה')).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      `${SEEDED_LOCKED_MONTH.month}/${SEEDED_LOCKED_MONTH.year}`,
    );

    // The month stays readable (§7.1) but offers no write affordances.
    await page.getByTestId(`day-${SEEDED_LOCKED_MONTH.year}-07-06`).click();
    await expect(page.getByRole('region', { name: /2026-07-06/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'עריכה' })).toHaveCount(0);
  });
});
