import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';

const USER_ID = '00000000-0000-0000-0000-000000000011';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000012';
const TASK_ID = '00000000-0000-0000-0000-000000000021';
const OTHER_TASK_ID = '00000000-0000-0000-0000-000000000022';
const ENTRY_ID = '00000000-0000-0000-0000-000000000031';

/** A stored row: 09:00-18:00 local on 2026-08-10 (Israel is UTC+3 in August). */
const ROW = {
  id: ENTRY_ID,
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

function createPrisma() {
  return {
    timeEntry: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(ROW),
      // Serves the overlap-candidate lookup; defaults to no neighbours.
      findMany: vi.fn().mockResolvedValue([]),
      // The write is scoped by owner and liveness, so it goes through
      // updateMany and re-reads the row it touched.
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: vi.fn().mockResolvedValue(ROW),
      delete: vi.fn().mockResolvedValue(ROW),
      create: vi.fn().mockResolvedValue(ROW),
    },
  };
}

function createScope(assigned = true, available = true) {
  return {
    isUserAssignedToTask: vi.fn().mockResolvedValue(assigned),
    assertUserAssignedToTask: vi.fn().mockImplementation(async () => {
      if (!assigned) throw new ForbiddenException({ details: [{ rule: 'VAL-33' }] });
    }),
    assertTaskAvailableForReporting: vi.fn().mockImplementation(async () => {
      if (!assigned) throw new ForbiddenException({ details: [{ rule: 'VAL-33' }] });
      if (!available) throw new ForbiddenException({ details: [{ rule: 'VAL-33A' }] });
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

describe('TimeEntriesService.update', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
  });

  it('applies a partial edit and returns the updated entry', async () => {
    const result = await createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' });

    expect(prisma.timeEntry.updateMany).toHaveBeenCalledOnce();
    expect(result.id).toBe(ENTRY_ID);
  });

  it('merges the patch onto the stored row, leaving untouched fields alone', async () => {
    await createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' });

    const call = prisma.timeEntry.updateMany.mock.calls[0]?.[0];
    expect(call.data.location).toBe('home');
    expect(call.data.task_id).toBe(TASK_ID);
    expect(call.data.start_at.toISOString()).toBe(ROW.start_at.toISOString());
  });

  it('looks the entry up scoped to the caller', async () => {
    await createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' });

    const call = prisma.timeEntry.findFirst.mock.calls[0]?.[0];
    expect(call.where).toMatchObject({ id: ENTRY_ID, user_id: USER_ID });
  });

  it('reports an unknown entry as not found', async () => {
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports an entry owned by somebody else as not found, revealing nothing', async () => {
    // The scoped lookup finds nothing, which is indistinguishable from a
    // missing entry — deliberately, so ids cannot be probed.
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).update(OTHER_USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('holds the merged entry to the rules a create must satisfy', async () => {
    // Moving only the start past the stored end must still fail VAL-31.
    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { startAt: '2026-08-10T16:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('re-checks the assignment on edit', async () => {
    const scope = createScope(false);

    await expect(
      createService(prisma, scope).update(USER_ID, ENTRY_ID, { taskId: TASK_ID }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('holds an edit onto a different task to the full availability check', async () => {
    const scope = createScope();

    await createService(prisma, scope).update(USER_ID, ENTRY_ID, { taskId: OTHER_TASK_ID });

    // Pointing an entry at other work is a fresh report of hours against it,
    // so it must clear the same bar a create does.
    expect(scope.assertTaskAvailableForReporting).toHaveBeenCalledWith(USER_ID, OTHER_TASK_ID);
    expect(scope.assertUserAssignedToTask).not.toHaveBeenCalled();
  });

  it('lets an entry on a task that has since closed still be corrected', async () => {
    // The task the entry already sits on is checked for assignment only. An
    // entry logged while the task was open must stay fixable after it closes,
    // or a typo is frozen into the month with no way out (§8.3).
    const scope = createScope(true, false);

    await createService(prisma, scope).update(USER_ID, ENTRY_ID, { location: 'home' });

    expect(scope.assertUserAssignedToTask).toHaveBeenCalledWith(USER_ID, TASK_ID);
    expect(scope.assertTaskAvailableForReporting).not.toHaveBeenCalled();
    expect(prisma.timeEntry.updateMany).toHaveBeenCalledOnce();
  });

  it('lets an entry on a task that has since closed still be deleted', async () => {
    const scope = createScope(true, false);

    await createService(prisma, scope).remove(USER_ID, ENTRY_ID);

    expect(prisma.timeEntry.delete).toHaveBeenCalledOnce();
  });

  it('refuses an edit in a locked month', async () => {
    const lock = createLock(true);

    await expect(
      createService(prisma, createScope(), lock).update(USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(lock.assertMonthNotLocked).toHaveBeenCalledWith(2026, 8);
  });

  it('checks the destination month too when the edit moves the entry', async () => {
    const lock = createLock();

    await createService(prisma, createScope(), lock).update(USER_ID, ENTRY_ID, {
      date: '2026-09-14',
      startAt: '2026-09-14T06:00:00.000Z',
      endAt: '2026-09-14T15:00:00.000Z',
    });

    // Both the month it left and the month it lands in must be open, so a
    // locked month cannot be filled by relocating entries into it.
    expect(lock.assertMonthNotLocked).toHaveBeenCalledWith(2026, 8);
    expect(lock.assertMonthNotLocked).toHaveBeenCalledWith(2026, 9);
  });

  it('does not re-check the same month twice when the entry stays put', async () => {
    const lock = createLock();

    await createService(prisma, createScope(), lock).update(USER_ID, ENTRY_ID, {
      location: 'home',
    });

    expect(lock.assertMonthNotLocked).toHaveBeenCalledTimes(1);
  });

  it('excludes the entry from its own overlap check', async () => {
    await createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' });

    const overlapQuery = prisma.timeEntry.count.mock.calls[0]?.[0];
    expect(overlapQuery.where.id).toEqual({ not: ENTRY_ID });
  });

  it('rejects an edit that would overlap another entry', async () => {
    prisma.timeEntry.count.mockResolvedValue(1);

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates the database no-overlap constraint into the same VAL-32 conflict', async () => {
    // The check and the write are not atomic, so a concurrent edit can slip
    // between them; the database refuses the loser and the caller must still
    // see VAL-32 rather than a 500.
    prisma.timeEntry.updateMany.mockRejectedValue(
      Object.assign(new Error('conflicting key value'), { code: '23P01' }),
    );

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toMatchObject({
      response: { statusCode: 409, details: [expect.objectContaining({ rule: 'VAL-32' })] },
    });
  });

  it('reports an entry deleted between the check and the write as missing', async () => {
    // The soft-delete extension rewrites reads and deletes but not updates, so
    // the scoped write is what keeps a deleted row from being mutated.
    prisma.timeEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes the write by owner and liveness, not by id alone', async () => {
    await createService(prisma).update(USER_ID, ENTRY_ID, { location: 'home' });

    const call = prisma.timeEntry.updateMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({ id: ENTRY_ID, user_id: USER_ID, deleted_at: null });
  });

  it('clears the description when an explicit null is sent', async () => {
    await createService(prisma).update(USER_ID, ENTRY_ID, { description: null });

    const call = prisma.timeEntry.updateMany.mock.calls[0]?.[0];
    expect(call.data.description).toBeNull();
  });

  it('refuses to edit a running entry rather than complaining about its end time', async () => {
    prisma.timeEntry.findFirst.mockResolvedValue({ ...ROW, end_at: null });

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { description: 'typo fix' }),
    ).rejects.toMatchObject({
      response: { details: [expect.objectContaining({ rule: 'VAL-RUNNING-ENTRY' })] },
    });
    expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('does not report a rule against a field the caller never sent', async () => {
    prisma.timeEntry.findFirst.mockResolvedValue({ ...ROW, end_at: null });

    await expect(
      createService(prisma).update(USER_ID, ENTRY_ID, { description: 'typo fix' }),
    ).rejects.not.toMatchObject({
      response: { details: [expect.objectContaining({ rule: 'VAL-31' })] },
    });
  });
});

describe('TimeEntriesService.remove', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
  });

  it('deletes the entry', async () => {
    await createService(prisma).remove(USER_ID, ENTRY_ID);

    expect(prisma.timeEntry.delete).toHaveBeenCalledWith({ where: { id: ENTRY_ID } });
  });

  it('relies on the soft-delete extension rather than stamping deleted_at itself', async () => {
    await createService(prisma).remove(USER_ID, ENTRY_ID);

    // A plain delete is correct: the Prisma extension rewrites it into a
    // deleted_at update for TimeEntry (§8.3).
    const call = prisma.timeEntry.delete.mock.calls[0]?.[0];
    expect(call.data).toBeUndefined();
  });

  it('looks the entry up scoped to the caller', async () => {
    await createService(prisma).remove(USER_ID, ENTRY_ID);

    const call = prisma.timeEntry.findFirst.mock.calls[0]?.[0];
    expect(call.where).toMatchObject({ id: ENTRY_ID, user_id: USER_ID });
  });

  it('reports an unknown entry as not found', async () => {
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    await expect(createService(prisma).remove(USER_ID, ENTRY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });

  it('refuses a delete in a locked month', async () => {
    const lock = createLock(true);

    await expect(
      createService(prisma, createScope(), lock).remove(USER_ID, ENTRY_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a running entry', async () => {
    prisma.timeEntry.findFirst.mockResolvedValue({ ...ROW, end_at: null });

    await expect(createService(prisma).remove(USER_ID, ENTRY_ID)).rejects.toMatchObject({
      response: { details: [expect.objectContaining({ rule: 'VAL-RUNNING-ENTRY' })] },
    });
    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });
});
