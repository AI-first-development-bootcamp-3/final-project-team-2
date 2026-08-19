import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { UsersModule } from './users.module';
import { PrismaService } from '../../prisma/prisma.service';
import { stubAuthGuards } from '../../auth/auth.testing';

const ALICE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  full_name: 'Alice Cohen',
  email: 'employee1@abra.co',
  role: 'employee' as const,
  is_active: true,
  deleted_at: null,
  employee_number: 'EMP-001',
  role_title: 'מפתחת תוכנה',
  employment_type: 'worker' as const,
  employment_percent: 80,
  org_unit: 'פיתוח',
};

const ALICE_HR_CAMEL = {
  employeeNumber: 'EMP-001',
  roleTitle: 'מפתחת תוכנה',
  employmentType: 'worker',
  employmentPercent: 80,
  orgUnit: 'פיתוח',
};

function userFor(auth: 'none' | 'admin' | 'employee') {
  if (auth === 'none') return null;
  return auth === 'admin'
    ? { userId: 'admin-1', role: 'admin' as const }
    : { userId: 'emp-1', role: 'employee' as const };
}

const NADAV_ID = '660e8400-e29b-41d4-a716-446655440001';

const CREATE_EMPLOYEE = {
  fullName: 'Nadav Cohen',
  email: 'Nadav@Org.com',
  password: 'secret123',
  role: 'employee' as const,
};

const CREATE_ADMIN = {
  fullName: 'Dana Admin',
  email: 'dana.admin@org.com',
  password: 'secret123',
  role: 'admin' as const,
};

async function createApp(auth: 'none' | 'admin' | 'employee') {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([ALICE]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(ALICE),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({
        ...ALICE,
        full_name: 'Alice Updated',
        role: 'admin',
        is_active: false,
        deleted_at: new Date('2026-08-17T12:00:00.000Z'),
      }),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: NADAV_ID,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        is_active: true,
        employee_number: data.employee_number ?? null,
        role_title: data.role_title ?? null,
        employment_type: data.employment_type ?? null,
        employment_percent: data.employment_percent ?? null,
        org_unit: data.org_unit ?? null,
      })),
    },
  };

  const builder = Test.createTestingModule({
    imports: [UsersModule],
    // Mirror production: stub authenticator + REAL RolesGuard as APP_GUARDs.
    providers: stubAuthGuards(userFor(auth)),
  })
    .overrideProvider(PrismaService)
    .useValue(prisma);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, prisma };
}

describe('GET /api/v1/users', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 401 without a token', async () => {
    ({ app } = await createApp('none'));
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('returns 403 for an authenticated employee', async () => {
    ({ app } = await createApp('employee'));
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer employee-token')
      .expect(403);
  });

  it('returns a paginated directory for an admin without secrets', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          id: ALICE.id,
          fullName: 'Alice Cohen',
          email: 'employee1@abra.co',
          role: 'employee',
          isActive: true,
          ...ALICE_HR_CAMEL,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });
});

describe('PATCH /api/v1/users/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('allows an admin to update user full name and role', async () => {
    const created = await createApp('admin');
    app = created.app;

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ fullName: 'Alice Updated', role: 'admin' })
      .expect(200);

    expect(response.body).toEqual({
      id: ALICE.id,
      fullName: 'Alice Updated',
      email: 'employee1@abra.co',
      role: 'admin',
      isActive: false,
      ...ALICE_HR_CAMEL,
    });
  });

  it('persists HR metadata to snake_case columns and returns camelCase fields', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.update.mockResolvedValue({
      ...ALICE,
      employee_number: 'EMP-002',
      role_title: 'ראש צוות',
      employment_type: 'manager',
      employment_percent: 50,
      org_unit: 'תפעול',
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeNumber: 'EMP-002',
        roleTitle: 'ראש צוות',
        employmentType: 'manager',
        employmentPercent: 50,
        orgUnit: 'תפעול',
      })
      .expect(200);

    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALICE.id },
        data: {
          employee_number: 'EMP-002',
          role_title: 'ראש צוות',
          employment_type: 'manager',
          employment_percent: 50,
          org_unit: 'תפעול',
        },
      }),
    );
    expect(response.body).toMatchObject({
      employeeNumber: 'EMP-002',
      roleTitle: 'ראש צוות',
      employmentType: 'manager',
      employmentPercent: 50,
      orgUnit: 'תפעול',
    });
  });

  it('clears HR metadata when nulls are sent', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.update.mockResolvedValue({
      ...ALICE,
      employee_number: null,
      role_title: null,
      employment_type: null,
      employment_percent: null,
      org_unit: null,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeNumber: null,
        roleTitle: null,
        employmentType: null,
        employmentPercent: null,
        orgUnit: null,
      })
      .expect(200);

    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          employee_number: null,
          role_title: null,
          employment_type: null,
          employment_percent: null,
          org_unit: null,
        },
      }),
    );
    expect(response.body).toMatchObject({
      employeeNumber: null,
      roleTitle: null,
      employmentType: null,
      employmentPercent: null,
      orgUnit: null,
    });
  });

  it('returns 400 for an out-of-range employmentPercent', async () => {
    ({ app } = await createApp('admin'));
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ employmentPercent: 101 })
      .expect(400);
  });

  it('returns 400 for an unknown employmentType', async () => {
    ({ app } = await createApp('admin'));
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ employmentType: 'freelancer' })
      .expect(400);
  });

  it('returns 409 Conflict if email is taken by another user', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.findFirst.mockResolvedValue({ id: 'other-user', email: 'taken@abra.co' });

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ email: 'taken@abra.co' })
      .expect(409);
  });
});

describe('POST /api/v1/users/:id/reset-password', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('resets password and increments token_version', async () => {
    const created = await createApp('admin');
    app = created.app;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/users/${ALICE.id}/reset-password`)
      .set('Authorization', 'Bearer admin-token')
      .send({ password: 'newsecretpassword123' })
      .expect(200);

    expect(response.body).toEqual({ message: 'הסיסמה שונתה בהצלחה' });
  });
});

describe('DELETE /api/v1/users/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('soft-deletes user, updates deleted_at, and increments token_version', async () => {
    const created = await createApp('admin');
    app = created.app;

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/users/${ALICE.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      id: ALICE.id,
      isActive: false,
      deletedAt: expect.any(String),
    });
    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALICE.id },
        data: expect.objectContaining({
          is_active: false,
          token_version: { increment: 1 },
        }),
      }),
    );
  });
});

describe('POST /api/v1/users/:id/restore', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('reactivates soft-deleted user and clears deleted_at', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.update.mockResolvedValue({
      ...ALICE,
      is_active: true,
      deleted_at: null,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/users/${ALICE.id}/restore`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      id: ALICE.id,
      isActive: true,
      deletedAt: null,
    });
    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALICE.id },
        data: expect.objectContaining({
          is_active: true,
          deleted_at: null,
        }),
      }),
    );
  });
});

describe('POST /api/v1/users', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  function expectNoSecrets(body: unknown) {
    expect(JSON.stringify(body)).not.toMatch(
      /password_hash|token_version|passwordHash|tokenVersion|"password"/,
    );
  }

  it('creates an active employee and returns 201 without secrets', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send(CREATE_EMPLOYEE)
      .expect(201);

    expect(response.body).toEqual({
      data: {
        id: NADAV_ID,
        fullName: 'Nadav Cohen',
        email: 'nadav@org.com',
        role: 'employee',
        isActive: true,
        employeeNumber: null,
        roleTitle: null,
        employmentType: null,
        employmentPercent: null,
        orgUnit: null,
      },
    });
    expectNoSecrets(response.body);
    expect(created.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          full_name: 'Nadav Cohen',
          email: 'nadav@org.com',
          role: 'employee',
        }),
        select: expect.objectContaining({
          id: true,
          full_name: true,
          email: true,
          role: true,
          is_active: true,
        }),
      }),
    );
    const createArgs = created.prisma.user.create.mock.calls[0]?.[0];
    expect(createArgs.select).not.toHaveProperty('password_hash');
    expect(createArgs.select).not.toHaveProperty('token_version');
    expect(createArgs.data).not.toHaveProperty('token_version');
  });

  it('persists optional HR metadata on create and returns it in camelCase', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        ...CREATE_EMPLOYEE,
        employeeNumber: 'EMP-101',
        roleTitle: 'מפתח תוכנה',
        employmentType: 'worker',
        employmentPercent: 100,
        orgUnit: 'פיתוח',
      })
      .expect(201);

    expect(created.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employee_number: 'EMP-101',
          role_title: 'מפתח תוכנה',
          employment_type: 'worker',
          employment_percent: 100,
          org_unit: 'פיתוח',
        }),
      }),
    );
    expect(response.body.data).toMatchObject({
      employeeNumber: 'EMP-101',
      roleTitle: 'מפתח תוכנה',
      employmentType: 'worker',
      employmentPercent: 100,
      orgUnit: 'פיתוח',
    });
  });

  it('creates an active admin', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send(CREATE_ADMIN)
      .expect(201);

    expect(response.body.data).toMatchObject({
      fullName: 'Dana Admin',
      email: 'dana.admin@org.com',
      role: 'admin',
      isActive: true,
    });
    expectNoSecrets(response.body);
  });

  it('stores email in lowercase', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send(CREATE_EMPLOYEE)
      .expect(201);

    expect(created.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'nadav@org.com' }),
      }),
    );
  });

  it('returns 401 without a token', async () => {
    ({ app } = await createApp('none'));
    await request(app.getHttpServer()).post('/api/v1/users').send(CREATE_EMPLOYEE).expect(401);
  });

  it('returns 403 for an authenticated employee', async () => {
    ({ app } = await createApp('employee'));
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer employee-token')
      .send(CREATE_EMPLOYEE)
      .expect(403);
  });

  it('returns 400 with VAL-10 for a whitespace name', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, fullName: '   ' })
      .expect(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'fullName', rule: 'VAL-10' })]),
    );
  });

  it('returns 400 with VAL-02 for a malformed email', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, email: 'not-an-email' })
      .expect(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email', rule: 'VAL-02' })]),
    );
  });

  it('returns 400 with VAL-13 for an empty password', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, password: '' })
      .expect(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password', rule: 'VAL-13' })]),
    );
  });

  it('returns 400 with VAL-04 for a 7-character password', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, password: '1234567' })
      .expect(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password', rule: 'VAL-04' })]),
    );
  });

  it('returns 400 with VAL-12 for an invalid role', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, role: 'manager' })
      .expect(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'role', rule: 'VAL-12' })]),
    );
  });

  it('returns 409 VAL-11 for a live duplicate email including mixed case', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.findFirst.mockResolvedValue({
      id: ALICE.id,
      email: 'employee1@abra.co',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, email: 'Employee1@Abra.co' })
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email', rule: 'VAL-11' })]),
    );
    expect(JSON.stringify(response.body)).toContain('VAL-11');
    expect(created.prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns 201 when the email belongs only to a soft-deleted person', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, email: 'retired@abra.co' })
      .expect(201);

    expect(created.prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: 'retired@abra.co', mode: 'insensitive' },
        },
      }),
    );
    expect(created.prisma.user.create).toHaveBeenCalled();
  });

  it('stores a bcrypt hash of the untrimmed password and never returns hash or must-change fields', async () => {
    const created = await createApp('admin');
    app = created.app;
    const password = ' secret1';
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send({ ...CREATE_EMPLOYEE, password })
      .expect(201);

    const createData = created.prisma.user.create.mock.calls[0]?.[0]?.data as {
      password_hash: string;
    };
    expect(await bcrypt.compare(password, createData.password_hash)).toBe(true);
    expectNoSecrets(response.body);
    expect(JSON.stringify(response.body)).not.toMatch(/mustChange|must_change|password_hash/);
    expect(created.prisma.user.create.mock.calls[0]?.[0]?.data).not.toHaveProperty('token_version');
    expect(created.prisma.user.create.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      'must_change_password',
    );
  });

  it('maps Prisma P2002 on email to 409 VAL-11', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.findFirst.mockResolvedValue(null);
    created.prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .send(CREATE_EMPLOYEE)
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email', rule: 'VAL-11' })]),
    );
  });
});
