import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
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
      findMany: vi.fn().mockResolvedValue([ROW]),
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
