import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';
import { SEEDED_EMPLOYEE } from '../fixtures/users';

export async function signInAsEmployee(
  page: Page,
  credentials: { email: string; password: string } = SEEDED_EMPLOYEE,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(credentials.email);
  await page.getByLabel('סיסמה', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'התחבר' }).click();
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await expect(page.getByRole('heading', { name: 'דיווח שעות' })).toBeVisible();
}

export async function employeeAccessToken(
  request: APIRequestContext,
  credentials: { email: string; password: string } = SEEDED_EMPLOYEE,
): Promise<string> {
  const login = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email: credentials.email, password: credentials.password },
  });
  if (!login.ok()) {
    throw new Error(`Employee ${credentials.email} could not sign in (HTTP ${login.status()}).`);
  }
  const body = (await login.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error(`Employee ${credentials.email} login returned no accessToken.`);
  }
  return body.accessToken;
}

export type AssignmentRow = {
  taskId: string;
  taskName: string;
  projectName: string;
  clientName: string;
};

export async function fetchMyAssignments(
  request: APIRequestContext,
  token: string,
): Promise<AssignmentRow[]> {
  const response = await request.get(`${API_BASE_URL}/me/assignments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    throw new Error(`GET /me/assignments failed (HTTP ${response.status()}).`);
  }
  const body = (await response.json()) as { data?: AssignmentRow[] };
  return body.data ?? [];
}
