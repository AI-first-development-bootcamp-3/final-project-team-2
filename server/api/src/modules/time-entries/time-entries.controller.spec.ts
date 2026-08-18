import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VAL_MESSAGES } from '@abra/contracts';
import { TimeEntriesModule } from './time-entries.module';
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

const validBody = {
  taskId: TASK_ID,
  date: '2026-08-10',
  startAt: '2026-08-10T06:00:00.000Z',
  endAt: '2026-08-10T15:00:00.000Z',
  location: 'office',
};

/** The same body with one field left out, built explicitly to keep lint quiet. */
const bodyWithoutLocation = {
  taskId: validBody.taskId,
  date: validBody.date,
  startAt: validBody.startAt,
  endAt: validBody.endAt,
};

/**
 * The app is compiled once for the whole file rather than per test.
 *
 * Booting Nest costs seconds of module compilation; doing it in every test
 * saturates the worker pool badly enough to push *other* suites' first tests
 * past their timeout. Everything a test needs to vary — who is calling, and
 * what the database returns — is held in these mutable fixtures instead.
 */
let currentUser: { userId: string; role: string } | null = null;

const prismaMock = {
  timeEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  monthLock: {
    findUnique: vi.fn(),
  },
  taskAssignment: {
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

/** First argument of a mock's first call, typed for assertion. */
function firstCallArg<T>(mock: { mock: { calls: unknown[][] } }): T {
  const [call] = mock.mock.calls;
  if (!call) {
    throw new Error('expected the mock to have been called');
  }
  return call[0] as T;
}

let app: INestApplication;

function signedInAsEmployee(userId = 'emp-1'): void {
  currentUser = { userId, role: 'employee' };
}

function signedInAsAdmin(): void {
  currentUser = { userId: 'admin-1', role: 'admin' };
}

function signedOut(): void {
  currentUser = null;
}

/** No lock row means the month is open (§8.1). */
function monthIsOpen(): void {
  prismaMock.monthLock.findUnique.mockResolvedValue(null);
}

function monthIs(lock: { is_locked: boolean }): void {
  prismaMock.monthLock.findUnique.mockResolvedValue(lock);
}

function taskIsAssigned(): void {
  prismaMock.taskAssignment.findUnique.mockResolvedValue({ id: 'assignment-1' });
}

function taskIsNotAssigned(): void {
  prismaMock.taskAssignment.findUnique.mockResolvedValue(null);
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [TimeEntriesModule] })
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
  prismaMock.timeEntry.create.mockResolvedValue(ROW);
  // findMany serves both the list read and the overlap-candidate lookup, so it
  // defaults to "no neighbours"; the GET suite supplies rows explicitly.
  prismaMock.timeEntry.findMany.mockResolvedValue([]);
  monthIsOpen();
  taskIsAssigned();
  signedInAsEmployee();
});

describe('POST /api/v1/time-entries', () => {
  it('creates an entry for the signed-in employee', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(validBody)
      .expect(201);

    expect(response.body.data).toMatchObject({ id: ROW.id, date: '2026-08-10' });
  });

  it('records the entry against the JWT user, ignoring a body-supplied owner', async () => {
    signedInAsEmployee('emp-42');

    await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send({ ...validBody, userId: 'emp-999' })
      .expect(201);

    const call = firstCallArg<{ data: { user_id: string } }>(prismaMock.timeEntry.create);
    expect(call.data.user_id).toBe('emp-42');
  });

  it('refuses an admin, who reports no hours of their own', async () => {
    signedInAsAdmin();

    await request(app.getHttpServer()).post('/api/v1/time-entries').send(validBody).expect(403);
  });

  it('refuses an unauthenticated request', async () => {
    signedOut();

    await request(app.getHttpServer()).post('/api/v1/time-entries').send(validBody).expect(403);
  });

  it('rejects a body missing its location with VAL-36 against that field', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(bodyWithoutLocation)
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'location', rule: 'VAL-36' })]),
    );
  });

  it('reports every broken rule at once', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send({ date: '2026-08-10' })
      .expect(400);

    const rules = response.body.details.map((detail: { rule: string }) => detail.rule);
    expect(rules).toEqual(expect.arrayContaining(['VAL-30', 'VAL-31', 'VAL-35', 'VAL-36']));
  });

  it('returns a Hebrew message alongside each rule code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(bodyWithoutLocation)
      .expect(400);

    const locationDetail = response.body.details.find(
      (detail: { field: string }) => detail.field === 'location',
    );
    expect(locationDetail.message).toBe(VAL_MESSAGES['VAL-36']);
  });

  it('refuses a write into a locked month with VAL-34', async () => {
    monthIs({ is_locked: true });

    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(validBody)
      .expect(403);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-34' })]),
    );
    expect(prismaMock.timeEntry.create).not.toHaveBeenCalled();
  });

  it('allows a write into a month whose lock has been reopened', async () => {
    monthIs({ is_locked: false });

    await request(app.getHttpServer()).post('/api/v1/time-entries').send(validBody).expect(201);
  });

  it('refuses a write against an unassigned task with VAL-33', async () => {
    taskIsNotAssigned();

    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(validBody)
      .expect(403);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-33' })]),
    );
    expect(prismaMock.timeEntry.create).not.toHaveBeenCalled();
  });
  it('rejects an overlapping entry with VAL-32', async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { id: 'existing-1', start_at: ROW.start_at, end_at: ROW.end_at },
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/v1/time-entries')
      .send(validBody)
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-32' })]),
    );
    expect(prismaMock.timeEntry.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/time-entries', () => {
  beforeEach(() => {
    prismaMock.timeEntry.findMany.mockResolvedValue([ROW]);
  });

  it('returns the caller own entries for a day', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/time-entries?date=2026-08-10')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      taskName: 'UI Design',
      clientName: 'Acme Corp',
    });
  });

  it('scopes the read to the authenticated employee', async () => {
    signedInAsEmployee('emp-42');

    await request(app.getHttpServer()).get('/api/v1/time-entries?date=2026-08-10').expect(200);

    const call = firstCallArg<{ where: { user_id: string } }>(prismaMock.timeEntry.findMany);
    expect(call.where.user_id).toBe('emp-42');
  });

  it('accepts an inclusive date range', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/time-entries?from=2026-08-01&to=2026-08-31')
      .expect(200);

    const call = firstCallArg<{ where: { date: { gte: Date; lte: Date } } }>(
      prismaMock.timeEntry.findMany,
    );
    expect(call.where.date.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(call.where.date.lte.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('rejects a request that names no period', async () => {
    await request(app.getHttpServer()).get('/api/v1/time-entries').expect(400);
  });

  it('rejects a backwards range', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/time-entries?from=2026-08-31&to=2026-08-01')
      .expect(400);
  });

  it('still permits reads in a locked month', async () => {
    monthIs({ is_locked: true });

    await request(app.getHttpServer()).get('/api/v1/time-entries?date=2026-08-10').expect(200);
  });

  it('refuses an admin', async () => {
    signedInAsAdmin();

    await request(app.getHttpServer()).get('/api/v1/time-entries?date=2026-08-10').expect(403);
  });
});

describe('PATCH /api/v1/time-entries/:id', () => {
  beforeEach(() => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(ROW);
    prismaMock.timeEntry.update.mockResolvedValue(ROW);
  });

  it('updates the entry and returns it', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/time-entries/${ROW.id}`)
      .send({ location: 'home' })
      .expect(200);

    expect(response.body.data).toMatchObject({ id: ROW.id });
  });

  it('rejects an empty patch', async () => {
    await request(app.getHttpServer()).patch(`/api/v1/time-entries/${ROW.id}`).send({}).expect(400);
  });

  it('answers 404 for an entry the caller does not own', async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch(`/api/v1/time-entries/${ROW.id}`)
      .send({ location: 'home' })
      .expect(404);
  });

  it('answers 409 for a running entry, naming VAL-RUNNING-ENTRY', async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue({ ...ROW, end_at: null });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/time-entries/${ROW.id}`)
      .send({ description: 'typo fix' })
      .expect(409);

    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'VAL-RUNNING-ENTRY' })]),
    );
  });

  it('answers 403 in a locked month', async () => {
    monthIs({ is_locked: true });

    await request(app.getHttpServer())
      .patch(`/api/v1/time-entries/${ROW.id}`)
      .send({ location: 'home' })
      .expect(403);
  });

  it('refuses an admin', async () => {
    signedInAsAdmin();

    await request(app.getHttpServer())
      .patch(`/api/v1/time-entries/${ROW.id}`)
      .send({ location: 'home' })
      .expect(403);
  });
});

describe('DELETE /api/v1/time-entries/:id', () => {
  beforeEach(() => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(ROW);
    prismaMock.timeEntry.delete.mockResolvedValue(ROW);
  });

  it('deletes the entry and answers 204 with no body', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/time-entries/${ROW.id}`)
      .expect(204);

    expect(response.body).toEqual({});
    expect(prismaMock.timeEntry.delete).toHaveBeenCalledOnce();
  });

  it('answers 404 for an entry the caller does not own', async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer()).delete(`/api/v1/time-entries/${ROW.id}`).expect(404);
  });

  it('answers 403 in a locked month', async () => {
    monthIs({ is_locked: true });

    await request(app.getHttpServer()).delete(`/api/v1/time-entries/${ROW.id}`).expect(403);
  });

  it('answers 409 for a running entry', async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue({ ...ROW, end_at: null });

    await request(app.getHttpServer()).delete(`/api/v1/time-entries/${ROW.id}`).expect(409);
  });

  it('refuses an admin', async () => {
    signedInAsAdmin();

    await request(app.getHttpServer()).delete(`/api/v1/time-entries/${ROW.id}`).expect(403);
  });
});
