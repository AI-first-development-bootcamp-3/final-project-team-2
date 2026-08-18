import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TasksModule } from './tasks.module';
import { PrismaService } from '../../prisma/prisma.service';
import { stubAuthGuards } from '../../auth/auth.testing';

const TASK = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Task One',
  project_id: '660e8400-e29b-41d4-a716-446655440000',
  status: 'open' as const,
  description: null,
  deleted_at: null,
  project: { name: 'Project Alpha', client: { name: 'Acme Corp' } },
};

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
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: TASK.project_id, is_active: true, deleted_at: null }),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [TasksModule],
    // Mirror production: stub authenticator + REAL RolesGuard as APP_GUARDs.
    providers: stubAuthGuards({ userId: 'admin-1', role: 'admin' }),
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, prisma };
}

describe('TasksController', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /api/v1/tasks returns paginated tasks', async () => {
    ({ app } = await createApp());
    const res = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Task One');
  });

  it('GET /api/v1/tasks fails on invalid query params', async () => {
    ({ app } = await createApp());
    await request(app.getHttpServer())
      .get('/api/v1/tasks?limit=invalid')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
  });

  it('GET /api/v1/tasks/:id returns single task', async () => {
    ({ app } = await createApp());
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${TASK.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(res.body.data.id).toBe(TASK.id);
  });

  it('POST /api/v1/tasks creates a task with valid payload', async () => {
    ({ app } = await createApp());
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Task One', projectId: TASK.project_id })
      .expect(201);

    expect(res.body.data.name).toBe('Task One');
  });

  it('POST /api/v1/tasks returns 400 with VAL-24 for empty name', async () => {
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

  it('POST /api/v1/tasks returns 422 with VAL-25 for inactive project', async () => {
    const created = await createApp();
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue({
      id: 'x',
      is_active: false,
      deleted_at: null,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'T', projectId: TASK.project_id })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'projectId', rule: 'VAL-25' })]),
    );
  });

  it('PATCH /api/v1/tasks/:id updates a task', async () => {
    ({ app } = await createApp());
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${TASK.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Updated Task' })
      .expect(200);

    expect(res.body.data).toBeDefined();
  });

  it('PATCH /api/v1/tasks/:id fails on invalid update payload', async () => {
    ({ app } = await createApp());
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${TASK.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '' })
      .expect(400);
  });

  it('DELETE /api/v1/tasks/:id soft-deletes task', async () => {
    ({ app } = await createApp());
    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/${TASK.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(204);
  });
});
