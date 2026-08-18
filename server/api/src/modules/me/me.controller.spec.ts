import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MeModule } from './me.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const ASSIGNMENT_ROW = {
  task: {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Task One',
    project: {
      id: '00000000-0000-0000-0000-000000000013',
      name: 'Project Alpha',
      client: {
        id: '00000000-0000-0000-0000-000000000014',
        name: 'Acme Corp',
      },
    },
  },
};

function employeeJwtGuard(userId = 'emp-1') {
  return {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { id: userId, role: 'employee' };
      return true;
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

async function createApp(guard: ReturnType<typeof employeeJwtGuard | typeof adminJwtGuard>) {
  const prisma = {
    taskAssignment: {
      findMany: vi.fn().mockResolvedValue([ASSIGNMENT_ROW]),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [MeModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideGuard(JwtGuard)
    .useValue(guard)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return { app, prisma };
}

describe('GET /api/v1/me/assignments', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns assignments for employee', async () => {
    const created = await createApp(employeeJwtGuard());
    app = created.app;
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data).toEqual([
      {
        taskId: '00000000-0000-0000-0000-000000000012',
        taskName: 'Task One',
        projectId: '00000000-0000-0000-0000-000000000013',
        projectName: 'Project Alpha',
        clientId: '00000000-0000-0000-0000-000000000014',
        clientName: 'Acme Corp',
      },
    ]);
  });

  it('filters to active entities only', async () => {
    const created = await createApp(employeeJwtGuard('emp-2'));
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(created.prisma.taskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            status: 'open',
            deleted_at: null,
            project: expect.objectContaining({
              is_active: true,
              deleted_at: null,
              client: expect.objectContaining({
                is_active: true,
                deleted_at: null,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('returns 403 for admin', async () => {
    ({ app } = await createApp(adminJwtGuard()));
    await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer admin-token')
      .expect(403);
  });

  it('omits a deactivated or removed projectId from the employee picker', async () => {
    const created = await createApp(employeeJwtGuard());
    app = created.app;
    created.prisma.taskAssignment.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: ASSIGNMENT_ROW.task.project.id }),
      ]),
    );
    expect(created.prisma.taskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            project: expect.objectContaining({
              is_active: true,
              deleted_at: null,
            }),
          }),
        }),
      }),
    );
  });

  it('returns empty array when no assignments', async () => {
    const created = await createApp(employeeJwtGuard());
    app = created.app;
    created.prisma.taskAssignment.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data).toEqual([]);
  });
});
