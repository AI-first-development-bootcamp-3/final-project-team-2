import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbsenceType } from '@abra/contracts';
import {
  AbsenceLockService,
  isAllowedWhileLocked,
  type AbsenceOperation,
} from './absence-lock.service';
import type { MonthLockService } from '../time-entries/month-lock.service';

/**
 * The §7.3 matrix, written out as data so a change that breaks one cell fails
 * one named case rather than passing quietly.
 */
const MATRIX: ReadonlyArray<{
  operation: AbsenceOperation;
  type: AbsenceType;
  allowedWhileLocked: boolean;
}> = [
  { operation: 'create', type: 'vacation', allowedWhileLocked: false },
  { operation: 'create', type: 'other', allowedWhileLocked: false },
  { operation: 'create', type: 'sick', allowedWhileLocked: true },
  { operation: 'create', type: 'military', allowedWhileLocked: true },
  { operation: 'update', type: 'vacation', allowedWhileLocked: false },
  { operation: 'update', type: 'sick', allowedWhileLocked: false },
  { operation: 'update', type: 'military', allowedWhileLocked: false },
  { operation: 'update', type: 'other', allowedWhileLocked: false },
  { operation: 'delete', type: 'vacation', allowedWhileLocked: false },
  { operation: 'delete', type: 'sick', allowedWhileLocked: false },
  { operation: 'delete', type: 'military', allowedWhileLocked: false },
  { operation: 'delete', type: 'other', allowedWhileLocked: false },
  { operation: 'attach', type: 'vacation', allowedWhileLocked: true },
  { operation: 'attach', type: 'sick', allowedWhileLocked: true },
  { operation: 'attach', type: 'military', allowedWhileLocked: true },
  { operation: 'attach', type: 'other', allowedWhileLocked: true },
];

describe('isAllowedWhileLocked', () => {
  for (const { operation, type, allowedWhileLocked } of MATRIX) {
    it(`${operation} ${type} is ${allowedWhileLocked ? 'allowed' : 'refused'} while locked`, () => {
      expect(isAllowedWhileLocked(operation, type)).toBe(allowedWhileLocked);
    });
  }

  it('allows creating sick and military only — the sole employee-side exception', () => {
    const allowed = (['vacation', 'sick', 'military', 'other'] as AbsenceType[]).filter((type) =>
      isAllowedWhileLocked('create', type),
    );
    expect(allowed).toEqual(['sick', 'military']);
  });
});

describe('AbsenceLockService', () => {
  let isMonthLocked: ReturnType<typeof vi.fn>;
  let service: AbsenceLockService;

  beforeEach(() => {
    isMonthLocked = vi.fn();
    service = new AbsenceLockService({ isMonthLocked } as unknown as MonthLockService);
  });

  it('permits every operation while the month is open', async () => {
    isMonthLocked.mockResolvedValue(false);

    for (const { operation, type } of MATRIX) {
      await expect(service.assertWritable(operation, type, 2026, 8)).resolves.toBeUndefined();
    }
  });

  it('refuses a locked-month write with VAL-45 against the start date', async () => {
    isMonthLocked.mockResolvedValue(true);

    await expect(service.assertWritable('create', 'vacation', 2026, 8)).rejects.toThrow(
      ForbiddenException,
    );

    try {
      await service.assertWritable('create', 'vacation', 2026, 8);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        statusCode: 403,
        details: [{ field: 'startDate', rule: 'VAL-45' }],
      });
    }
  });

  it('lets a sick absence through a locked month', async () => {
    isMonthLocked.mockResolvedValue(true);
    await expect(service.assertWritable('create', 'sick', 2026, 8)).resolves.toBeUndefined();
  });

  it('lets a military absence through a locked month', async () => {
    isMonthLocked.mockResolvedValue(true);
    await expect(service.assertWritable('create', 'military', 2026, 8)).resolves.toBeUndefined();
  });

  it('refuses editing a sick absence in a locked month — only creation is excepted', async () => {
    isMonthLocked.mockResolvedValue(true);
    await expect(service.assertWritable('update', 'sick', 2026, 8)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets a document be attached in a locked month', async () => {
    isMonthLocked.mockResolvedValue(true);
    await expect(service.assertWritable('attach', 'vacation', 2026, 8)).resolves.toBeUndefined();
  });

  it('treats a reopened month as open', async () => {
    // MonthLockService already reports is_locked=false as unlocked; this asserts
    // the matrix does not second-guess it.
    isMonthLocked.mockResolvedValue(false);
    await expect(service.assertWritable('delete', 'vacation', 2026, 8)).resolves.toBeUndefined();
  });

  it('does not query the lock for an operation the lock never blocks', async () => {
    await service.assertWritable('attach', 'sick', 2026, 8);
    expect(isMonthLocked).not.toHaveBeenCalled();
  });

  it('queries the month it was given', async () => {
    isMonthLocked.mockResolvedValue(false);
    await service.assertWritable('create', 'vacation', 2027, 3);
    expect(isMonthLocked).toHaveBeenCalledWith(2027, 3);
  });
});
