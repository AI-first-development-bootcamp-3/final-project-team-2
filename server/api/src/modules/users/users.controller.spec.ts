import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { UsersModule } from './users.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const ALICE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  full_name: 'Alice Cohen',
  email: 'employee1@abra.co',
  role: 'employee' as const,
  is_active: true,
};

function adminJwtGuard() {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { id: 'admin-1', role: 'admin' };
      return true;
    },
  };
}

function employeeJwtGuard() {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { id: 'emp-1', role: 'employee' };
      return true;
    },
  };
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
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: NADAV_ID,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        is_active: true,
      })),
    },
  };

  const builder = Test.createTestingModule({
    imports: [UsersModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma);

  if (auth === 'admin') {
    builder.overrideGuard(JwtGuard).useValue(adminJwtGuard());
  } else if (auth === 'employee') {
    builder.overrideGuard(JwtGuard).useValue(employeeJwtGuard());
  }

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
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /password_hash|token_version|passwordHash|tokenVersion/,
    );
    expect(created.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 0,
        select: expect.objectContaining({
          id: true,
          full_name: true,
          email: true,
          role: true,
          is_active: true,
        }),
      }),
    );
    const select = created.prisma.user.findMany.mock.calls[0]?.[0]?.select ?? {};
    expect(select).not.toHaveProperty('password_hash');
    expect(select).not.toHaveProperty('token_version');
  });

  it('defaults to page size 20', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(created.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it('returns empty data with the real total for a past-last page', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.user.findMany.mockResolvedValue([]);
    created.prisma.user.count.mockResolvedValue(3);

    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ page: 99, limit: 20 })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 99, limit: 20, total: 3 },
    });
  });

  it('returns 400 when limit is greater than 100', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ limit: 101 })
      .set('Authorization', 'Bearer admin-token')
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'limit', rule: 'VAL-LIMIT' })]),
    );
  });

  it('applies trimmed q as case-insensitive name/email OR search', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ q: '  alice  ' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          {
            OR: [
              { full_name: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
        ]),
      }),
    );
  });

  it('treats whitespace-only q as no text filter', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ q: '   ' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(where ?? {})).not.toContain('contains');
  });

  it('combines role and isActive with AND semantics', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ role: 'admin', isActive: 'false' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ role: 'admin' }, { is_active: false }]),
      }),
    );
  });

  it('does not set deleted_at when includeDeleted is off', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where ?? {};
    expect(where).not.toHaveProperty('deleted_at');
  });

  it('sets an explicit deleted_at predicate when includeDeleted is true', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ includeDeleted: 'true' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toHaveProperty('deleted_at');
  });

  it('still applies isActive when includeDeleted is true', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ includeDeleted: 'true', isActive: 'true' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    const where = created.prisma.user.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual(
      expect.objectContaining({
        deleted_at: expect.anything(),
        AND: expect.arrayContaining([{ is_active: true }]),
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
