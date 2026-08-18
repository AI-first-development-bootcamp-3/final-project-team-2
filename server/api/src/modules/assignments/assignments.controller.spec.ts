import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { AssignmentsModule } from './assignments.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const ASSIGNMENT = {
  id: 'a0000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000011',
  task_id: '00000000-0000-0000-0000-000000000012',
  user: { full_name: 'Alice Cohen', email: 'alice@abra.co' },
  task: { name: 'Task One', project: { name: 'Project Alpha', client: { name: 'Acme Corp' } } },
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
    taskAssignment: {
      findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(ASSIGNMENT),
      create: vi.fn().mockResolvedValue(ASSIGNMENT),
      delete: vi.fn().mockResolvedValue(ASSIGNMENT),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: ASSIGNMENT.user_id, deleted_at: null }),
    },
    task: {
      findUnique: vi.fn().mockResolvedValue({ id: ASSIGNMENT.task_id, deleted_at: null }),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AssignmentsModule],
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

describe('AssignmentsController', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /api/v1/assignments returns paginated assignments', async () => {
    ({ app } = await createApp());
    const response = await request(app.getHttpServer())
      .get('/api/v1/assignments')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userFullName).toBe('Alice Cohen');
  });

  it('GET /api/v1/assignments fails on invalid query params', async () => {
    ({ app } = await createApp());
    await request(app.getHttpServer())
      .get('/api/v1/assignments?userId=invalid')
      .set('Authorization', 'Bearer admin-token')
      .expect(400);
  });

  it('POST /api/v1/assignments creates a valid assignment', async () => {
    ({ app } = await createApp());
    const response = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set('Authorization', 'Bearer admin-token')
      .send({ userId: ASSIGNMENT.user_id, taskId: ASSIGNMENT.task_id })
      .expect(201);

    expect(response.body.data.id).toBe(ASSIGNMENT.id);
  });

  it('POST /api/v1/assignments returns 409 on duplicate assignment', async () => {
    const created = await createApp();
    app = created.app;
    created.prisma.taskAssignment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['user_id', 'task_id'] },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set('Authorization', 'Bearer admin-token')
      .send({ userId: ASSIGNMENT.user_id, taskId: ASSIGNMENT.task_id })
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-27' })]),
    );
  });

  it('POST /api/v1/assignments returns 422 on invalid refs', async () => {
    const created = await createApp();
    app = created.app;
    created.prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set('Authorization', 'Bearer admin-token')
      .send({ userId: ASSIGNMENT.user_id, taskId: ASSIGNMENT.task_id })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-26' })]),
    );
  });

  it('DELETE /api/v1/assignments/:id returns 204 on successful delete', async () => {
    const created = await createApp();
    app = created.app;
    await request(app.getHttpServer())
      .delete(`/api/v1/assignments/${ASSIGNMENT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(204);
  });
});
