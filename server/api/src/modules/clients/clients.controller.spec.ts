import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ClientsModule } from './clients.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const ACME = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Corp',
  contact_info: 'info@acme.com',
  is_active: true,
  deleted_at: null,
};

function noAuthJwtGuard() {
  return {
    canActivate() {
      return false;
    },
  };
}

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
    client: {
      findMany: vi.fn().mockResolvedValue([ACME]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(ACME),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(ACME),
      update: vi.fn().mockResolvedValue(ACME),
    },
  };

  const builder = Test.createTestingModule({
    imports: [ClientsModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma);

  if (auth === 'admin') {
    builder.overrideGuard(JwtGuard).useValue(adminJwtGuard());
  } else if (auth === 'employee') {
    builder.overrideGuard(JwtGuard).useValue(employeeJwtGuard());
  } else {
    builder.overrideGuard(JwtGuard).useValue(noAuthJwtGuard());
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, prisma };
}

describe('GET /api/v1/clients', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects unauthenticated requests', async () => {
    ({ app } = await createApp('none'));
    await request(app.getHttpServer()).get('/api/v1/clients').expect(403);
  });

  it('returns 403 for an employee', async () => {
    ({ app } = await createApp('employee'));
    await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', 'Bearer employee-token')
      .expect(403);
  });

  it('returns paginated clients for admin', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      data: [
        {
          id: ACME.id,
          name: 'Acme Corp',
          contactInfo: 'info@acme.com',
          isActive: true,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });
});

describe('POST /api/v1/clients', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('creates a client and returns 201', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Acme Corp' })
      .expect(201);

    expect(response.body.data).toMatchObject({ name: 'Acme Corp', isActive: true });
  });

  it('returns 400 with VAL-20 for empty name', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-20' })]),
    );
  });

  it('returns 409 with VAL-21 for duplicate name', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.client.findFirst.mockResolvedValue(ACME);

    const response = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Acme Corp' })
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-21' })]),
    );
  });
});

describe('PATCH /api/v1/clients/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('updates a client', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .patch(`/api/v1/clients/${ACME.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Updated' })
      .expect(200);
  });
});

describe('DELETE /api/v1/clients/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('soft-deletes and returns 204', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .delete(`/api/v1/clients/${ACME.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(204);
  });
});
