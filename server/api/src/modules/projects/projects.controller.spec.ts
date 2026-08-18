import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VAL_MESSAGES } from '@abra/contracts';
import { ProjectsModule } from './projects.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

const PROJECT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Project Alpha',
  client_id: '660e8400-e29b-41d4-a716-446655440000',
  is_active: true,
  report_type: 'TOTAL_HOURS' as const,
  deleted_at: null as Date | null,
  client: { name: 'Acme Corp' },
};

const TASK = {
  id: '880e8400-e29b-41d4-a716-446655440000',
  project_id: PROJECT.id,
  name: 'Open Task',
  status: 'open',
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

async function createApp(auth: 'none' | 'admin' | 'employee' = 'admin') {
  const prisma = {
    project: {
      findMany: vi.fn().mockResolvedValue([PROJECT]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(PROJECT),
      create: vi.fn().mockResolvedValue(PROJECT),
      update: vi.fn().mockResolvedValue(PROJECT),
    },
    client: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: PROJECT.client_id, is_active: true, deleted_at: null }),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([TASK]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    timeEntry: {
      findFirst: vi.fn(),
    },
  };

  const builder = Test.createTestingModule({
    imports: [ProjectsModule],
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

const ITEM = {
  id: PROJECT.id,
  name: 'Project Alpha',
  clientId: PROJECT.client_id,
  clientName: 'Acme Corp',
  isActive: true,
  isDeleted: false,
  reportType: 'TOTAL_HOURS',
};

describe('GET /api/v1/projects', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 401 without a token', async () => {
    ({ app } = await createApp('none'));
    await request(app.getHttpServer()).get('/api/v1/projects').expect(401);
  });

  it('returns 403 for an authenticated employee', async () => {
    ({ app } = await createApp('employee'));
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer employee-token')
      .expect(403);
  });

  it('returns 200 with clientName join, isDeleted, default limit 20 and sort=name', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      data: [ITEM],
      meta: { page: 1, limit: 20, total: 1 },
    });
    expect(created.prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
        take: 20,
        skip: 0,
      }),
    );
  });

  it('searches by q and filters by clientId', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ q: '  Alpha  ', clientId: PROJECT.client_id })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(created.prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { name: { contains: 'Alpha', mode: 'insensitive' } },
            { client_id: PROJECT.client_id },
          ]),
        }),
      }),
    );
  });

  it('returns isDeleted true rows when includeDeleted=true', async () => {
    const created = await createApp('admin');
    app = created.app;
    const removed = {
      ...PROJECT,
      deleted_at: new Date('2026-08-01T00:00:00.000Z'),
    };
    created.prisma.project.findMany.mockResolvedValue([removed]);
    created.prisma.project.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ includeDeleted: 'true' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.data[0]).toMatchObject({
      id: PROJECT.id,
      name: 'Project Alpha',
      clientName: 'Acme Corp',
      isDeleted: true,
    });
  });

  it('returns 200 with empty data and real meta.total on a past-last page', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.findMany.mockResolvedValue([]);
    created.prisma.project.count.mockResolvedValue(3);

    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ page: 9 })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 9, limit: 20, total: 3 },
    });
  });

  it('sorts by clientName via related client.name', async () => {
    const created = await createApp('admin');
    app = created.app;
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ sort: 'clientName', order: 'desc' })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(created.prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { client: { name: 'desc' } },
      }),
    );
  });
});

describe('GET /api/v1/projects/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 { data } for a live project', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body).toEqual({ data: ITEM });
  });

  it('returns 404 Hebrew for a missing project', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);

    expect(response.body.message).toBe('פרויקט לא נמצא');
  });

  it('returns 404 for a removed project', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue({
      ...PROJECT,
      deleted_at: new Date(),
    });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });
});

describe('POST /api/v1/projects', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 401 without a token', async () => {
    ({ app } = await createApp('none'));
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(401);
  });

  it('returns 403 for an authenticated employee', async () => {
    ({ app } = await createApp('employee'));
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer employee-token')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(403);
  });

  it('creates an active project with joined clientName and returns 201', async () => {
    const created = await createApp('admin');
    app = created.app;
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Project Alpha', clientId: PROJECT.client_id })
      .expect(201);

    expect(response.body).toEqual({ data: ITEM });
    expect(created.prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Project Alpha',
          client_id: PROJECT.client_id,
        }),
      }),
    );
  });

  it('returns 400 with VAL-22 for empty name', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '', clientId: PROJECT.client_id })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          rule: 'VAL-22',
          message: VAL_MESSAGES['VAL-22'],
        }),
      ]),
    );
  });

  it('returns 400 with VAL-22 for whitespace-only name', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '   ', clientId: PROJECT.client_id })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-22' })]),
    );
  });

  it('returns 400 with VAL-23 for missing clientId', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Project Alpha' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'clientId',
          rule: 'VAL-23',
          message: VAL_MESSAGES['VAL-23'],
        }),
      ]),
    );
  });

  it('returns 400 with VAL-23 for malformed clientId', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Project Alpha', clientId: 'not-a-uuid' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'clientId', rule: 'VAL-23' })]),
    );
  });

  it('returns 422 with VAL-23 for inactive client', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.client.findUnique.mockResolvedValue({
      id: PROJECT.client_id,
      is_active: false,
      deleted_at: null,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'clientId',
          rule: 'VAL-23',
          message: VAL_MESSAGES['VAL-23'],
        }),
      ]),
    );
  });

  it('returns 422 with VAL-23 for removed client', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.client.findUnique.mockResolvedValue({
      id: PROJECT.client_id,
      is_active: true,
      deleted_at: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(422);
  });

  it('returns 422 with VAL-23 for unknown client', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.client.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'P', clientId: PROJECT.client_id })
      .expect(422);
  });

  it('allows a second project to reuse an existing name', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.create.mockResolvedValue({
      ...PROJECT,
      id: '990e8400-e29b-41d4-a716-446655440000',
    });

    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Project Alpha', clientId: PROJECT.client_id })
      .expect(201);

    expect(created.prisma.project.create).toHaveBeenCalledTimes(1);
  });
});

describe('PATCH /api/v1/projects/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('updates name and returns 200', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.update.mockResolvedValue({ ...PROJECT, name: 'Renamed' });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Renamed' })
      .expect(200);

    expect(response.body.data).toMatchObject({ name: 'Renamed', isDeleted: false });
  });

  it('moves the project to another active client', async () => {
    const created = await createApp('admin');
    app = created.app;
    const otherClientId = '770e8400-e29b-41d4-a716-446655440000';
    created.prisma.client.findUnique.mockResolvedValue({
      id: otherClientId,
      is_active: true,
      deleted_at: null,
    });
    created.prisma.project.update.mockResolvedValue({
      ...PROJECT,
      client_id: otherClientId,
      client: { name: 'Globex Ltd' },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ clientId: otherClientId })
      .expect(200);

    expect(response.body.data).toMatchObject({
      clientId: otherClientId,
      clientName: 'Globex Ltd',
    });
  });

  it('returns 422 VAL-23 when changing to an inactive client', async () => {
    const created = await createApp('admin');
    app = created.app;
    const otherClientId = '770e8400-e29b-41d4-a716-446655440000';
    created.prisma.client.findUnique.mockResolvedValue({
      id: otherClientId,
      is_active: false,
      deleted_at: null,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ clientId: otherClientId })
      .expect(422);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'clientId', rule: 'VAL-23' })]),
    );
  });

  it('returns 200 when saving name with the same clientId even if the parent client is inactive', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.client.findUnique.mockResolvedValue({
      id: PROJECT.client_id,
      is_active: false,
      deleted_at: null,
    });
    created.prisma.project.update.mockResolvedValue({ ...PROJECT, name: 'Still Here' });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Still Here', clientId: PROJECT.client_id })
      .expect(200);

    expect(created.prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it('PATCH isActive=false does not write child tasks', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.update.mockResolvedValue({ ...PROJECT, is_active: false });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ isActive: false })
      .expect(200);

    expect(created.prisma.task.update).not.toHaveBeenCalled();
    expect(created.prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown or removed id', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'X' })
      .expect(404);
  });

  it('returns 400 VAL-22 for whitespace name', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: '   ' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', rule: 'VAL-22' })]),
    );
  });
});

describe('PATCH /api/v1/projects/:id/report-type', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('updates project reportType to CLOCK_IN_OUT and returns 200', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.update.mockResolvedValue({
      ...PROJECT,
      report_type: 'CLOCK_IN_OUT',
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}/report-type`)
      .set('Authorization', 'Bearer admin-token')
      .send({ reportType: 'CLOCK_IN_OUT' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: PROJECT.id,
      reportType: 'CLOCK_IN_OUT',
    });
  });

  it('returns 400 with VAL-28 and a Hebrew message on invalid reportType enum value', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}/report-type`)
      .set('Authorization', 'Bearer admin-token')
      .send({ reportType: 'INVALID_ENUM' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'reportType',
          rule: 'VAL-28',
          message: 'יש לבחור אופן דיווח תקין',
        }),
      ]),
    );
  });

  it('returns 400 VAL-25 for a malformed project id instead of a 500', async () => {
    ({ app } = await createApp('admin'));
    const response = await request(app.getHttpServer())
      .patch('/api/v1/projects/not-a-uuid/report-type')
      .set('Authorization', 'Bearer admin-token')
      .send({ reportType: 'CLOCK_IN_OUT' })
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'id', rule: 'VAL-25' })]),
    );
  });

  it('mutates report_type through the same prisma update path as the generic PATCH', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.update.mockResolvedValue({
      ...PROJECT,
      report_type: 'CLOCK_IN_OUT',
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT.id}/report-type`)
      .set('Authorization', 'Bearer admin-token')
      .send({ reportType: 'CLOCK_IN_OUT' })
      .expect(200);

    expect(created.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROJECT.id },
        data: { report_type: 'CLOCK_IN_OUT' },
      }),
    );
  });
});

describe('DELETE /api/v1/projects/:id', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('soft-removes and returns 204 with an empty body', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.update.mockResolvedValue({ ...PROJECT, deleted_at: new Date() });

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(204);

    expect(response.body).toEqual({});
    expect(created.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
    expect(created.prisma.task.update).not.toHaveBeenCalled();
    expect(created.prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown id', async () => {
    const created = await createApp('admin');
    app = created.app;
    created.prisma.project.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${PROJECT.id}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(404);
  });
});
