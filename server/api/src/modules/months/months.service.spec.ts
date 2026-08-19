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

function createTimeEntries(entries: (typeof augustEntry)[]) {
  return { list: vi.fn().mockResolvedValue(entries) };
}

function createMonthLock(status: { isLocked: boolean; lockedAt: string | null }) {
  return { getLockStatus: vi.fn().mockResolvedValue(status) };
}

const OPEN = { isLocked: false, lockedAt: null };

describe('MonthsService', () => {
  describe('a month with entries', () => {
    let timeEntries: ReturnType<typeof createTimeEntries>;
    let service: MonthsService;

    beforeEach(() => {
      timeEntries = createTimeEntries([augustEntry]);
      service = new MonthsService(timeEntries as never, createMonthLock(OPEN) as never);
    });

    it('returns the entries, an empty absences array, and the lock status together', async () => {
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
      const service = new MonthsService(
        createTimeEntries([]) as never,
        createMonthLock(OPEN) as never,
      );

      await expect(service.getMonth('user-1', 2026, 9)).resolves.toEqual({
        entries: [],
        absences: [],
        lock: OPEN,
      });
    });
  });

  describe('a locked month', () => {
    it('reports the lock with its timestamp', async () => {
      const monthLock = createMonthLock({
        isLocked: true,
        lockedAt: '2026-09-01T08:00:00.000Z',
      });
      const service = new MonthsService(createTimeEntries([]) as never, monthLock as never);

      const result = await service.getMonth('user-1', 2026, 8);

      expect(result.lock).toEqual({ isLocked: true, lockedAt: '2026-09-01T08:00:00.000Z' });
      expect(monthLock.getLockStatus).toHaveBeenCalledWith(2026, 8);
    });
  });
});
