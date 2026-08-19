import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonthsService } from './months.service';

const augustEntry = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  date: '2026-08-03',
  startAt: '2026-08-03T05:00:00.000Z',
  endAt: '2026-08-03T14:00:00.000Z',
  location: 'office' as const,
  description: null,
  taskId: '660e8400-e29b-41d4-a716-446655440000',
  // Names survive soft-deletion of their rows (§8.3) — the list read
  // denormalises them, and the month query must pass them through untouched.
  taskName: 'Closed Task',
  projectId: '770e8400-e29b-41d4-a716-446655440000',
  projectName: 'Archived Project',
  clientId: '880e8400-e29b-41d4-a716-446655440000',
  clientName: 'Deactivated Client',
};

type AbsenceRow = { start_date: Date; end_date: Date };

function createTimeEntries(entries: (typeof augustEntry)[]) {
  return { list: vi.fn().mockResolvedValue(entries) };
}

function createPrisma(options?: {
  lock?: { is_locked: boolean; locked_at: Date } | null;
  absences?: AbsenceRow[];
}) {
  return {
    monthLock: { findUnique: vi.fn().mockResolvedValue(options?.lock ?? null) },
    absence: { findMany: vi.fn().mockResolvedValue(options?.absences ?? []) },
  };
}

function createService(
  prisma: ReturnType<typeof createPrisma>,
  timeEntries: ReturnType<typeof createTimeEntries>,
) {
  return new MonthsService(prisma as never, timeEntries as never);
}

const OPEN = { isLocked: false, lockedAt: null };

describe('MonthsService', () => {
  describe('a month with entries', () => {
    let timeEntries: ReturnType<typeof createTimeEntries>;
    let service: MonthsService;

    beforeEach(() => {
      timeEntries = createTimeEntries([augustEntry]);
      service = createService(createPrisma(), timeEntries);
    });

    it('returns the entries, the absences, and the lock status together', async () => {
      await expect(service.getMonth('user-1', 2026, 8)).resolves.toEqual({
        entries: [augustEntry],
        absences: [],
        lock: OPEN,
      });
    });

    it('delegates the read to the time-entries list scoped to the caller and the month range', async () => {
      await service.getMonth('user-1', 2026, 8);
      expect(timeEntries.list).toHaveBeenCalledWith('user-1', {
        from: '2026-08-01',
        to: '2026-08-31',
      });
    });

    it('passes denormalised names through for entries referencing deleted rows', async () => {
      const { entries } = await service.getMonth('user-1', 2026, 8);
      expect(entries[0]).toMatchObject({
        taskName: 'Closed Task',
        projectName: 'Archived Project',
        clientName: 'Deactivated Client',
      });
    });
  });

  describe('an empty month', () => {
    it('returns empty collections rather than an error', async () => {
      const service = createService(createPrisma(), createTimeEntries([]));

      await expect(service.getMonth('user-1', 2026, 9)).resolves.toEqual({
        entries: [],
        absences: [],
        lock: OPEN,
      });
    });
  });

  describe('absences', () => {
    it('returns the local-date bounds of absences overlapping the month', async () => {
      const prisma = createPrisma({
        absences: [
          {
            start_date: new Date('2026-08-10T00:00:00.000Z'),
            end_date: new Date('2026-08-12T00:00:00.000Z'),
          },
        ],
      });
      const service = createService(prisma, createTimeEntries([]));

      const { absences } = await service.getMonth('user-1', 2026, 8);

      expect(absences).toEqual([{ startDate: '2026-08-10', endDate: '2026-08-12' }]);
    });

    it('scopes the query to the caller, excludes soft-deleted rows, and matches by inclusive overlap', async () => {
      const prisma = createPrisma();
      const service = createService(prisma, createTimeEntries([]));

      await service.getMonth('user-42', 2026, 8);

      // Inclusive overlap: starts on or before the month's last day AND ends
      // on or after its first — so an absence spanning a month boundary shows
      // up in both months.
      expect(prisma.absence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: 'user-42',
            deleted_at: null,
            start_date: { lte: new Date('2026-08-31T00:00:00.000Z') },
            end_date: { gte: new Date('2026-08-01T00:00:00.000Z') },
          },
        }),
      );
    });
  });

  describe('a locked month', () => {
    it('reports the lock with its timestamp', async () => {
      const prisma = createPrisma({
        lock: { is_locked: true, locked_at: new Date('2026-09-01T08:00:00.000Z') },
      });
      const service = createService(prisma, createTimeEntries([]));

      const result = await service.getMonth('user-1', 2026, 8);

      expect(result.lock).toEqual({ isLocked: true, lockedAt: '2026-09-01T08:00:00.000Z' });
      expect(prisma.monthLock.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year_month: { year: 2026, month: 8 } } }),
      );
    });

    it('does not leak a stale locked_at from a reopened month', async () => {
      const prisma = createPrisma({
        lock: { is_locked: false, locked_at: new Date('2026-09-01T08:00:00.000Z') },
      });
      const service = createService(prisma, createTimeEntries([]));

      const result = await service.getMonth('user-1', 2026, 8);

      expect(result.lock).toEqual({ isLocked: false, lockedAt: null });
    });
  });
});
