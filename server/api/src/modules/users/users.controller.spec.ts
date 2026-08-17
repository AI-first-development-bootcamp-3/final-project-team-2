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
  deleted_at: null,
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
      findUnique: vi.fn().mockResolvedValue(ALICE),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({
        ...ALICE,
        full_name: 'Alice Updated',
        role: 'admin',
      }),
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
      isActive: true,
    });
    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALICE.id },
        data: expect.objectContaining({
          full_name: 'Alice Updated',
          role: 'admin',
        }),
      }),
    );
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
    expect(created.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALICE.id },
        data: expect.objectContaining({
          token_version: { increment: 1 },
        }),
      }),
    );
  });

  it('returns 400 if password is less than 8 characters', async () => {
    ({ app } = await createApp('admin'));

    await request(app.getHttpServer())
      .post(`/api/v1/users/${ALICE.id}/reset-password`)
      .set('Authorization', 'Bearer admin-token')
      .send({ password: 'short' })
      .expect(400);
  });
});
