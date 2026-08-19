import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';

const USER_ID = '00000000-0000-0000-0000-000000000011';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000012';
const TASK_ID = '00000000-0000-0000-0000-000000000021';

/** A row as Prisma returns it, with the `@db.Date` column at UTC midnight. */
const ROW = {
  id: '00000000-0000-0000-0000-000000000031',
  date: new Date('2026-08-10T00:00:00.000Z'),
  start_at: new Date('2026-08-10T06:00:00.000Z'),
  end_at: new Date('2026-08-10T15:00:00.000Z'),
  location: 'office' as const,
  description: 'Sprint work',
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
  location: 'office' as const,
};

function createPrisma() {
  return {
    timeEntry: {
      create: vi.fn().mockResolvedValue(ROW),
      // Serves both the list reads and the overlap-candidate lookup; tests that
      // care about collisions override it.
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createScope(assigned = true) {
  return {
    isUserAssignedToTask: vi.fn().mockResolvedValue(assigned),
    assertUserAssignedToTask: vi.fn().mockImplementation(async () => {
      if (!assigned) throw new ForbiddenException({ details: [{ rule: 'VAL-33' }] });
    }),
  };
}

function createLock(locked = false) {
  return {
    isMonthLocked: vi.fn().mockResolvedValue(locked),
    assertMonthNotLocked: vi.fn().mockImplementation(async () => {
      if (locked) throw new ForbiddenException({ details: [{ rule: 'VAL-34' }] });
    }),
  };
}

function createService(
  prisma: ReturnType<typeof createPrisma>,
  scope = createScope(),
  lock = createLock(),
) {
  return new TimeEntriesService(prisma as never, scope as never, lock as never);
}

describe('TimeEntriesService.create', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
  });

  it('persists a valid entry and returns it', async () => {
    const result = await createService(prisma).create(USER_ID, validBody);

    expect(prisma.timeEntry.create).toHaveBeenCalledOnce();
    expect(result.id).toBe(ROW.id);
    expect(result.date).toBe('2026-08-10');
  });

  it('takes ownership from the authenticated user, never from the body', async () => {
    await createService(prisma).create(USER_ID, {
      ...validBody,
      // A caller trying to report against somebody else.
      userId: OTHER_USER_ID,
    } as never);

    const call = prisma.timeEntry.create.mock.calls[0]?.[0];
    expect(call.data.user_id).toBe(USER_ID);
  });

  it('stores the date column at UTC midnight of the local day', async () => {
    await createService(prisma).create(USER_ID, validBody);

    const call = prisma.timeEntry.create.mock.calls[0]?.[0];
    expect(call.data.date.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('checks the month lock before writing', async () => {
    const lock = createLock(true);
    await expect(
      createService(prisma, createScope(), lock).create(USER_ID, validBody),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(lock.assertMonthNotLocked).toHaveBeenCalledWith(2026, 8);
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('checks the assignment before writing', async () => {
    const scope = createScope(false);
    await expect(createService(prisma, scope).create(USER_ID, validBody)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(scope.assertUserAssignedToTask).toHaveBeenCalledWith(USER_ID, TASK_ID);
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('derives the lock month from the entry date, not from today', async () => {
    const lock = createLock();
    await createService(prisma, createScope(), lock).create(USER_ID, {
      ...validBody,
      date: '2026-01-05',
      startAt: '2026-01-05T07:00:00.000Z',
      endAt: '2026-01-05T15:00:00.000Z',
    });

    expect(lock.assertMonthNotLocked).toHaveBeenCalledWith(2026, 1);
  });

  it('stores a missing description as null rather than undefined', async () => {
    await createService(prisma).create(USER_ID, validBody);

    const call = prisma.timeEntry.create.mock.calls[0]?.[0];
    expect(call.data.description).toBeNull();
  });
});

describe('TimeEntriesService.list', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
    prisma.timeEntry.findMany.mockResolvedValue([ROW]);
  });

  it('scopes every read to the caller', async () => {
    await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(call.where.user_id).toBe(USER_ID);
  });

  it('filters to a single day when given a date', async () => {
    await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(call.where.date.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('filters to an inclusive range when given from and to', async () => {
    await createService(prisma).list(USER_ID, { from: '2026-08-01', to: '2026-08-31' });

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(call.where.date.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(call.where.date.lte.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('returns entries oldest first', async () => {
    await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(call.orderBy).toEqual([{ date: 'asc' }, { start_at: 'asc' }]);
  });

  it('denormalises task, project and client names onto each entry', async () => {
    const [entry] = await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    expect(entry).toMatchObject({
      taskName: 'UI Design',
      projectName: 'Website Redesign',
      clientName: 'Acme Corp',
    });
  });

  it('emits instants as ISO UTC strings', async () => {
    const [entry] = await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    expect(entry?.startAt).toBe('2026-08-10T06:00:00.000Z');
    expect(entry?.endAt).toBe('2026-08-10T15:00:00.000Z');
  });

  it('tolerates a running entry with no end time and no task', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      { ...ROW, end_at: null, task_id: null, task: null, location: null },
    ]);

    const [entry] = await createService(prisma).list(USER_ID, { date: '2026-08-10' });

    expect(entry?.endAt).toBeNull();
    expect(entry?.taskName).toBeNull();
    expect(entry?.clientName).toBeNull();
  });

  it('still returns names for an entry whose task has since been closed', async () => {
    // Soft-deleted rows are filtered by the Prisma extension, but a *closed*
    // task is still joined — history must keep rendering it (§8.3).
    const [entry] = await createService(prisma).list(USER_ID, { date: '2026-08-10' });
    expect(entry?.taskName).toBe('UI Design');
  });
});

/** Israel is UTC+3 in August, so local clock times read naturally here. */
function at(date: string, time: string): string {
  return `${date}T${time}:00.000+03:00`;
}

function existing(startDate: string, start: string, endDate: string, end: string) {
  return {
    id: 'existing-1',
    start_at: new Date(at(startDate, start)),
    end_at: new Date(at(endDate, end)),
  };
}

function bodyFor(startDate: string, start: string, endDate: string, end: string) {
  return {
    ...validBody,
    date: startDate,
    startAt: new Date(at(startDate, start)).toISOString(),
    endAt: new Date(at(endDate, end)).toISOString(),
  };
}

describe('TimeEntriesService.create — overlap (VAL-32)', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
  });

  async function attempt(body: ReturnType<typeof bodyFor>) {
    return createService(prisma).create(USER_ID, body);
  }

  it('rejects an entry overlapping an existing one', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      existing('2026-08-10', '09:00', '2026-08-10', '12:00'),
    ]);

    await expect(
      attempt(bodyFor('2026-08-10', '11:00', '2026-08-10', '13:00')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('names VAL-32 in the error envelope', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      existing('2026-08-10', '09:00', '2026-08-10', '12:00'),
    ]);

    await expect(
      attempt(bodyFor('2026-08-10', '11:00', '2026-08-10', '13:00')),
    ).rejects.toMatchObject({
      response: { statusCode: 409, details: [expect.objectContaining({ rule: 'VAL-32' })] },
    });
  });

  it('accepts an entry that starts exactly where another ended', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      existing('2026-08-10', '09:00', '2026-08-10', '12:00'),
    ]);

    await expect(
      attempt(bodyFor('2026-08-10', '12:00', '2026-08-10', '14:00')),
    ).resolves.toBeDefined();
    expect(prisma.timeEntry.create).toHaveBeenCalledOnce();
  });

  it('accepts an entry when the employee has none', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([]);

    await expect(
      attempt(bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00')),
    ).resolves.toBeDefined();
  });

  it('rejects a morning entry colliding with the previous night shift', async () => {
    // 22:00 on the 10th to 06:00 on the 11th.
    prisma.timeEntry.findMany.mockResolvedValue([
      existing('2026-08-10', '22:00', '2026-08-11', '06:00'),
    ]);

    await expect(
      attempt(bodyFor('2026-08-11', '05:00', '2026-08-11', '07:00')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a night shift colliding with an entry on the following morning', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      existing('2026-08-11', '05:00', '2026-08-11', '07:00'),
    ]);

    await expect(
      attempt(bodyFor('2026-08-10', '22:00', '2026-08-11', '06:00')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores an existing entry that is still running', async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      { id: 'running-1', start_at: new Date(at('2026-08-10', '10:00')), end_at: null },
    ]);

    await expect(
      attempt(bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00')),
    ).resolves.toBeDefined();
  });

  it('widens the candidate window by a day on each side to catch night shifts', async () => {
    await attempt(bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00'));

    const overlapQuery = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    const start = new Date(at('2026-08-10', '09:00')).getTime();
    const end = new Date(at('2026-08-10', '17:00')).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    expect(overlapQuery.where.start_at.gte.getTime()).toBe(start - dayMs);
    expect(overlapQuery.where.start_at.lte.getTime()).toBe(end + dayMs);
  });

  it('scopes the candidate lookup to the employee, so another user cannot collide', async () => {
    await attempt(bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00'));

    const overlapQuery = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(overlapQuery.where.user_id).toBe(USER_ID);
  });

  it('relies on the soft-delete extension rather than filtering deleted rows itself', async () => {
    await attempt(bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00'));

    // Setting deleted_at here would override the extension default and start
    // matching deleted rows, so its absence is the assertion.
    const overlapQuery = prisma.timeEntry.findMany.mock.calls[0]?.[0];
    expect(overlapQuery.where.deleted_at).toBeUndefined();
  });

  it('checks the month lock and the assignment before querying for overlaps', async () => {
    const lock = createLock(true);
    await expect(
      createService(prisma, createScope(), lock).create(
        USER_ID,
        bodyFor('2026-08-10', '09:00', '2026-08-10', '17:00'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.timeEntry.findMany).not.toHaveBeenCalled();
  });
});
