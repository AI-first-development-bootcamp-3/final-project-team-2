import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MonthLockService } from './month-lock.service';

function createPrisma(lock: { is_locked: boolean } | null) {
  return {
    monthLock: {
      findUnique: vi.fn().mockResolvedValue(lock),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new MonthLockService(prisma as never);
}

describe('MonthLockService', () => {
  describe('a month that was never locked', () => {
    let prisma: ReturnType<typeof createPrisma>;
    let service: MonthLockService;

    beforeEach(() => {
      prisma = createPrisma(null);
      service = createService(prisma);
    });

    it('is not locked', async () => {
      await expect(service.isMonthLocked(2026, 8)).resolves.toBe(false);
    });

    it('permits writes', async () => {
      await expect(service.assertMonthNotLocked(2026, 8)).resolves.toBeUndefined();
    });

    it('looks the month up by its year and month pair', async () => {
      await service.isMonthLocked(2026, 8);
      expect(prisma.monthLock.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year_month: { year: 2026, month: 8 } } }),
      );
    });
  });

  describe('a locked month', () => {
    let service: MonthLockService;

    beforeEach(() => {
      service = createService(createPrisma({ is_locked: true }));
    });

    it('is locked', async () => {
      await expect(service.isMonthLocked(2026, 7)).resolves.toBe(true);
    });

    it('refuses writes with 403', async () => {
      await expect(service.assertMonthNotLocked(2026, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('names VAL-34 against the date field', async () => {
      await expect(service.assertMonthNotLocked(2026, 7)).rejects.toMatchObject({
        response: {
          statusCode: 403,
          details: [expect.objectContaining({ field: 'date', rule: 'VAL-34' })],
        },
      });
    });
  });

  describe('a month that was locked and then reopened', () => {
    let service: MonthLockService;

    beforeEach(() => {
      // The row survives an unlock with is_locked flipped to false (§8.1).
      service = createService(createPrisma({ is_locked: false }));
    });

    it('is open again', async () => {
      await expect(service.isMonthLocked(2026, 7)).resolves.toBe(false);
    });

    it('permits writes again', async () => {
      await expect(service.assertMonthNotLocked(2026, 7)).resolves.toBeUndefined();
    });
  });
});
