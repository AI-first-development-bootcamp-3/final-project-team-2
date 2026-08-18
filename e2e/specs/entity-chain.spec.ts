import { expect, test } from '@playwright/test';
import { SEEDED_EMPLOYEE } from '../fixtures/users';
import {
  assignEmployeeViaConsole,
  createClientViaConsole,
  createProjectViaConsole,
  createTaskViaConsole,
  fetchMyAssignments,
} from '../helpers/catalog-chain';
import { CREATED_EMPLOYEE_PASSWORD } from '../helpers/credentials';
import { uniqueEmail } from '../helpers/unique-email';
import { uniqueName } from '../helpers/unique-name';
import { createEmployeeViaUsers, signInAsAdmin } from '../helpers/users-directory';

test.describe('Entity catalog chain E2E', () => {
  test('admin creates client → project → task → assignment on the console; dedicated picker is exactly that chain', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);

    const email = uniqueEmail();
    const fullName = `E2E ${email.replace('@abra.co', '')}`;
    const clientName = uniqueName('client');
    const projectName = uniqueName('project');
    const taskName = uniqueName('task');

    await signInAsAdmin(page);
    await expect(page, 'Admin must leave /login after seed credentials (FR-012).').not.toHaveURL(
      /\/login/,
    );

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
    await assignEmployeeViaConsole(page, {
      fullName,
      email,
      taskName,
      projectName,
      clientName,
    });

    const dedicated = await fetchMyAssignments(request, email, CREATED_EMPLOYEE_PASSWORD);
    expect(dedicated.status).toBe(200);
    expect(dedicated.data).toHaveLength(1);
    expect(dedicated.data[0]).toMatchObject({
      clientName,
      projectName,
      taskName,
    });

    const seeded = await fetchMyAssignments(
      request,
      SEEDED_EMPLOYEE.email,
      SEEDED_EMPLOYEE.password,
    );
    expect(seeded.status).toBe(200);
    expect(seeded.data.some((item) => item.taskName === taskName)).toBe(false);
  });
});
