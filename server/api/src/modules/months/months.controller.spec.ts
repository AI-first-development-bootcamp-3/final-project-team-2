import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MonthQueryResponseSchema } from '@abra/contracts';
import { MonthsModule } from './months.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

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

/**
 * Compiled once for the file, same as the time-entries suite: booting Nest per
 * test saturates the worker pool. Who is calling and what the database returns
 * live in these mutable fixtures.
 */
let currentUser: { userId: string; role: string } | null = null;

const prismaMock = {
  timeEntry: {
    findMany: vi.fn(),
  },
  monthLock: {
    findUnique: vi.fn(),
  },
};

const jwtGuardMock = {
  canActivate(context: ExecutionContext) {
    if (currentUser === null) {
      return false;
    }
    context.switchToHttp().getRequest().user = currentUser;
    return true;
  },
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [MonthsModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .overrideGuard(JwtGuard)
    .useValue(jwtGuardMock)
    .compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.timeEntry.findMany.mockResolvedValue([]);
  prismaMock.monthLock.findUnique.mockResolvedValue(null);
  currentUser = { userId: 'emp-1', role: 'employee' };
});

describe('GET /api/v1/months/:year/:month', () => {
  it('returns entries, absences, and lock status in the contract shape', async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([ROW]);

    const response = await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(200);

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
    const response = await request(app.getHttpServer()).get('/api/v1/months/2026/9').expect(200);

    expect(response.body.data).toEqual({
      entries: [],
      absences: [],
      lock: { isLocked: false, lockedAt: null },
    });
  });

  it('reports a locked month with its lock instant', async () => {
    prismaMock.monthLock.findUnique.mockResolvedValue({
      is_locked: true,
      locked_at: new Date('2026-09-01T08:00:00.000Z'),
    });

    const response = await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(200);

    expect(response.body.data.lock).toEqual({
      isLocked: true,
      lockedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('scopes the read to the JWT user', async () => {
    currentUser = { userId: 'emp-42', role: 'employee' };

    await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(200);

    expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: 'emp-42' }) }),
    );
  });

  it('rejects a month outside 1-12', async () => {
    await request(app.getHttpServer()).get('/api/v1/months/2026/13').expect(400);
  });

  it('rejects a non-numeric year', async () => {
    await request(app.getHttpServer()).get('/api/v1/months/abcd/8').expect(400);
  });

  it('refuses an unauthenticated request', async () => {
    // The mocked guard refuses with 403; the real JwtGuard answers 401 and is
    // proven in the auth suite.
    currentUser = null;

    await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(403);
  });

  it('refuses an admin', async () => {
    // Admins report no hours of their own (ADR-26); their view of employee
    // months belongs to the Month Close epic.
    currentUser = { userId: 'admin-1', role: 'admin' };

    await request(app.getHttpServer()).get('/api/v1/months/2026/8').expect(403);
  });
});
