import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ProjectsModule } from './projects.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const PROJECT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Project Alpha',
  client_id: '660e8400-e29b-41d4-a716-446655440000',
  is_active: true,
  deleted_at: null,
  client: { name: 'Acme Corp' },
};

function adminJwtGuard() {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { id: 'admin-1', role: 'admin' };
      return true;
    },
  };
}

async function createApp() {
  const prisma = {
    project: {
      findMany: vi.fn().mockResolvedValue([PROJECT]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(PROJECT),
      create: vi.fn().mockResolvedValue(PROJECT),
      update: vi.fn().mockResolvedValue(PROJECT),
    },
    client: {
      findUnique: vi.fn().mockResolvedValue({ id: PROJECT.client_id, is_active: true, deleted_at: null }),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [ProjectsModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideGuard(JwtGuard)
    .useValue(adminJwtGuard())
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, prisma };
}

describe('POST /api/v1/projects', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 400 with VAL-22 for empty name', async () => {
    ({ app } = await createApp());
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '', clientId: PROJECT.client_id })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-22' })]),
    );
  });

  it('returns 422 with VAL-23 for inactive client', async () => {
    const created = await createApp();
    app = created.app;
    created.prisma.client.findUnique.mockResolvedValue({ id: 'x', is_active: false, deleted_at: null });

    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'clientId', rule: 'VAL-23' })]),
    );
  });

  it('creates a project and returns 201', async () => {
    const created = await createApp();
    app = created.app;
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Project Alpha', clientId: PROJECT.client_id })
      .expect(201);
  });
});
