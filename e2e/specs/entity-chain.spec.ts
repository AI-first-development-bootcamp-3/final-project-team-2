import { test, expect } from '@playwright/test';

test.describe.skip('Entity catalog chain E2E', () => {
  test('admin creates client, project, task, assignment and employee sees it in /me/assignments', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const adminEmail = 'admin@abra.co';
    const adminPassword = 'Admin123!';
    const employeeEmail = `employee_e2e_${timestamp}@abra.co`;
    const employeePassword = 'Employee123!';

    // 1. Admin login
    const adminLogin = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(adminLogin.ok()).toBe(true);
    const adminToken = (await adminLogin.json()).data.accessToken;

    // 2. Admin creates employee
    const createEmpRes = await request.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        fullName: `E2E Employee ${timestamp}`,
        email: employeeEmail,
        password: employeePassword,
        role: 'employee',
      },
    });
    expect(createEmpRes.status()).toBe(201);
    const employeeUser = (await createEmpRes.json()).data;

    // 3. Employee login
    const employeeLogin = await request.post('/api/v1/auth/login', {
      data: { email: employeeEmail, password: employeePassword },
    });
    expect(employeeLogin.ok()).toBe(true);
    const employeeToken = (await employeeLogin.json()).data.accessToken;

    // 4. Admin creates client
    const clientRes = await request.post('/api/v1/clients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `E2E Client ${timestamp}`,
        contactInfo: 'e2e@client.com',
      },
    });
    expect(clientRes.status()).toBe(201);
    const client = (await clientRes.json()).data;

    // 5. Admin creates project
    const projectRes = await request.post('/api/v1/projects', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `E2E Project ${timestamp}`,
        clientId: client.id,
      },
    });
    expect(projectRes.status()).toBe(201);
    const project = (await projectRes.json()).data;

    // 6. Admin creates task
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

    // 7. Admin creates assignment
    const assignmentRes = await request.post('/api/v1/assignments', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        userId: employeeUser.id,
        taskId: task.id,
      },
    });
    expect(assignmentRes.status()).toBe(201);

    // 8. Employee fetches /me/assignments
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
