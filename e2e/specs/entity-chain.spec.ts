import { test, expect } from '@playwright/test';

test.describe('Entity catalog chain E2E', () => {
  test('admin creates client, project, task, assignment and employee sees it in /me/assignments', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `admin_e2e_${timestamp}@example.com`;
    const employeeEmail = `employee_e2e_${timestamp}@example.com`;
    const password = 'Password123!';

    const adminSignup = await request.post('/api/v1/auth/signup', {
      data: {
        firstName: 'E2E',
        lastName: 'Admin',
        email: adminEmail,
        password,
        role: 'admin',
      },
    });
    expect(adminSignup.ok()).toBe(true);

    const adminLogin = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password },
    });
    expect(adminLogin.ok()).toBe(true);
    const adminToken = (await adminLogin.json()).data.accessToken;

    const employeeSignup = await request.post('/api/v1/auth/signup', {
      data: {
        firstName: 'E2E',
        lastName: 'Employee',
        email: employeeEmail,
        password,
        role: 'employee',
      },
    });
    expect(employeeSignup.ok()).toBe(true);
    const employeeUser = (await employeeSignup.json()).data.user;

    const employeeLogin = await request.post('/api/v1/auth/login', {
      data: { email: employeeEmail, password },
    });
    expect(employeeLogin.ok()).toBe(true);
    const employeeToken = (await employeeLogin.json()).data.accessToken;

    const clientRes = await request.post('/api/v1/clients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `E2E Client ${timestamp}`,
        contactInfo: 'e2e@client.com',
      },
    });
    expect(clientRes.status()).toBe(201);
    const client = (await clientRes.json()).data;

    const projectRes = await request.post('/api/v1/projects', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `E2E Project ${timestamp}`,
        clientId: client.id,
      },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()).data;

    const taskRes = await request.post('/api/v1/tasks', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `E2E Task ${timestamp}`,
        projectId: project.id,
        description: 'E2E task description',
      },
    });
    expect(taskRes.status()).toBe(201);
    const task = (await taskRes.json()).data;

    const assignmentRes = await request.post('/api/v1/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        userId: employeeUser.id,
        taskId: task.id,
      },
    });
    expect(assignmentRes.status()).toBe(201);

    const myAssignmentsRes = await request.get('/api/v1/me/assignments', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    expect(myAssignmentsRes.status()).toBe(200);
    const assignments = (await myAssignmentsRes.json()).data;

    const found = assignments.find((a: { taskId: string }) => a.taskId === task.id);
    expect(found).toBeDefined();
    expect(found.clientName).toBe(client.name);
    expect(found.projectName).toBe(project.name);
    expect(found.taskName).toBe(task.name);
  });
});
