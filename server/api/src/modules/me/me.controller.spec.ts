import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MeModule } from './me.module';
import { PrismaService } from '../../prisma/prisma.service';
import { stubAuthGuards } from '../../auth/auth.testing';
import type { AuthenticatedUser } from '../../auth/jwt.guard';

const ASSIGNMENT_ROW = {
  task: {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Task One',
    project: {
      id: '00000000-0000-0000-0000-000000000013',
      name: 'Project Alpha',
      report_type: 'TOTAL_HOURS' as const,
      client: {
        id: '00000000-0000-0000-0000-000000000014',
        name: 'Acme Corp',
      },
    },
  },
};

function employee(userId = 'emp-1'): AuthenticatedUser {
  return { userId, role: 'employee' };
}

function admin(): AuthenticatedUser {
  return { userId: 'admin-1', role: 'admin' };
}

async function createApp(user: AuthenticatedUser) {
  const prisma = {
    taskAssignment: {
      findMany: vi.fn().mockResolvedValue([ASSIGNMENT_ROW]),
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [MeModule],
    // Mirror production: stub authenticator + REAL RolesGuard as APP_GUARDs.
    providers: stubAuthGuards(user),
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
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
    const created = await createApp(employee());
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
        reportType: 'TOTAL_HOURS',
      },
    ]);
  });

  it('scopes the query to the authenticated employee userId from the JWT', async () => {
    const created = await createApp(employee('emp-42'));
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(created.prisma.taskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'emp-42',
        }),
      }),
    );
  });

  it('filters to active entities only', async () => {
    const created = await createApp(employee('emp-2'));
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
    ({ app } = await createApp(admin()));
    await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer admin-token')
      .expect(403);
  });

  it('omits a deactivated or removed projectId from the employee picker', async () => {
    const created = await createApp(employee());
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
    const created = await createApp(employee());
    app = created.app;
    created.prisma.taskAssignment.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me/assignments')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data).toEqual([]);
  });
});
