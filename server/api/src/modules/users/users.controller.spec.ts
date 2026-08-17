import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
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

async function createApp(auth: 'none' | 'admin' | 'employee') {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([ALICE]),
      count: vi.fn().mockResolvedValue(1),
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
