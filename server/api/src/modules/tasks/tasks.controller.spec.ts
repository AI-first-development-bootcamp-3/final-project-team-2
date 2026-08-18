import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TasksModule } from './tasks.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const TASK = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Task One',
  project_id: '660e8400-e29b-41d4-a716-446655440000',
  status: 'open' as const,
  description: null,
  deleted_at: null,
  project: { name: 'Project Alpha', client: { name: 'Acme Corp' } },
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
    task: {
      findMany: vi.fn().mockResolvedValue([TASK]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(TASK),
      create: vi.fn().mockResolvedValue(TASK),
      update: vi.fn().mockResolvedValue(TASK),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ id: TASK.project_id, is_active: true, deleted_at: null }),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [TasksModule],
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

describe('POST /api/v1/tasks', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 400 with VAL-24 for empty name', async () => {
    ({ app } = await createApp());
    const response = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '', projectId: TASK.project_id })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-24' })]),
    );
  });

  it('returns 422 with VAL-25 for inactive project', async () => {
    const created = await createApp();
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue({ id: 'x', is_active: false, deleted_at: null });

    const response = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'T', projectId: TASK.project_id })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'projectId', rule: 'VAL-25' })]),
    );
  });
});
