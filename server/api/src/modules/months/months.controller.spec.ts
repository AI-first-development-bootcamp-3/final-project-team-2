import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MonthQueryResponseSchema } from '@abra/contracts';
import { MonthsModule } from './months.module';
import { PrismaService } from '../../prisma/prisma.service';
import { stubAuthGuards } from '../../auth/auth.testing';
import type { AuthenticatedUser } from '../../auth/jwt.guard';

const TASK_ID = '00000000-0000-0000-0000-000000000021';

const ROW = {
  id: '00000000-0000-0000-0000-000000000031',
  date: new Date('2026-08-10T00:00:00.000Z'),
  start_at: new Date('2026-08-10T06:00:00.000Z'),
  end_at: new Date('2026-08-10T15:00:00.000Z'),
  location: 'office' as const,
  description: null,
  task_id: TASK_ID,
  task: {
    id: TASK_ID,
    name: 'UI Design',
    project: {
      id: '00000000-0000-0000-0000-000000000041',
      name: 'Website Redesign',
      client: { id: '00000000-0000-0000-0000-000000000051', name: 'Acme Corp' },
    },
  },
};

function employee(userId = 'emp-1'): AuthenticatedUser {
  return { userId, role: 'employee' };
}

function admin(): AuthenticatedUser {
  return { userId: 'admin-1', role: 'admin' };
}

async function createApp(user: AuthenticatedUser | null) {
  const prisma = {
    timeEntry: { findMany: vi.fn().mockResolvedValue([]) },
    absence: { findMany: vi.fn().mockResolvedValue([]) },
    monthLock: { findUnique: vi.fn().mockResolvedValue(null) },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [MonthsModule],
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

describe('GET /api/v1/months/:year/:month', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns entries, absences, and lock status in the contract shape', async () => {
    const created = await createApp(employee());
    app = created.app;
    created.prisma.timeEntry.findMany.mockResolvedValue([ROW]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/months/2026/8')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(() => MonthQueryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.data.entries).toHaveLength(1);
    expect(response.body.data.entries[0]).toMatchObject({
      id: ROW.id,
      date: '2026-08-10',
      taskName: 'UI Design',
      clientName: 'Acme Corp',
    });
    expect(response.body.data.absences).toEqual([]);
    expect(response.body.data.lock).toEqual({ isLocked: false, lockedAt: null });
  });

  it('returns empty collections for an empty month', async () => {
    const created = await createApp(employee());
    app = created.app;

    const response = await request(app.getHttpServer())
      .get('/api/v1/months/2026/9')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data).toEqual({
      entries: [],
      absences: [],
      lock: { isLocked: false, lockedAt: null },
    });
  });

  it("returns the caller's absences overlapping the month as local-date bounds", async () => {
    const created = await createApp(employee('emp-7'));
    app = created.app;
    created.prisma.absence.findMany.mockResolvedValue([
      {
        start_date: new Date('2026-08-13T00:00:00.000Z'),
        end_date: new Date('2026-08-13T00:00:00.000Z'),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/months/2026/8')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data.absences).toEqual([
      { startDate: '2026-08-13', endDate: '2026-08-13' },
    ]);
    expect(created.prisma.absence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_id: 'emp-7', deleted_at: null }),
      }),
    );
  });

  it('reports a locked month with its lock instant', async () => {
    const created = await createApp(employee());
    app = created.app;
    created.prisma.monthLock.findUnique.mockResolvedValue({
      is_locked: true,
      locked_at: new Date('2026-09-01T08:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/months/2026/8')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(response.body.data.lock).toEqual({
      isLocked: true,
      lockedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('scopes the read to the JWT user', async () => {
    const created = await createApp(employee('emp-42'));
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/months/2026/8')
      .set('Authorization', 'Bearer emp-token')
      .expect(200);

    expect(created.prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: 'emp-42' }) }),
    );
  });

  it('rejects a month outside 1-12', async () => {
    const created = await createApp(employee());
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/months/2026/13')
      .set('Authorization', 'Bearer emp-token')
      .expect(400);
  });

  it('rejects a non-numeric year', async () => {
    const created = await createApp(employee());
    app = created.app;

    await request(app.getHttpServer())
      .get('/api/v1/months/abcd/8')
      .set('Authorization', 'Bearer emp-token')
      .expect(400);
  });

  it('returns 401 without a token', async () => {
    // The stub authenticator refuses exactly like the real JwtGuard with no
    // token: UnauthorizedException, not a mocked 403.
    ({ app } = await createApp(null));

    await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(401);
  });

  it('returns 403 for admin', async () => {
    // Admins report no hours of their own (ADR-26); their view of employee
    // months belongs to the Month Close epic.
    ({ app } = await createApp(admin()));

    await request(app.getHttpServer())
      .get('/api/v1/months/2026/8')
      .set('Authorization', 'Bearer admin-token')
      .expect(403);
  });
});
