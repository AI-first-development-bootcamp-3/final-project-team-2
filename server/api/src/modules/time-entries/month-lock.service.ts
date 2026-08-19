import { ForbiddenException, Injectable } from '@nestjs/common';
import { VAL_MESSAGES } from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Month-lock enforcement (VAL-34, §8.1).
 *
 * The spec is explicit that this must be planted on day one because
 * retrofitting is expensive, so it ships here as real behaviour rather than a
 * placeholder: the MonthLock table already exists and its read semantics are
 * complete on their own.
 *
 *   no row            -> open
 *   is_locked = true  -> locked
 *   is_locked = false -> locked once, since reopened, open again
 *
 * The Month Close epic (KAN-98) adds the lock/unlock *write* endpoints and the
 * pre-lock warnings on top of this; it does not need to change what is here.
 */
export interface MonthLockStatus {
  isLocked: boolean;
  /** ISO 8601 instant of the lock, or null while the month is open. */
  lockedAt: string | null;
}

@Injectable()
export class MonthLockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether writes are currently permitted in the given month. */
  async isMonthLocked(year: number, month: number): Promise<boolean> {
    const lock = await this.prisma.monthLock.findUnique({
      where: { year_month: { year, month } },
      select: { is_locked: true },
    });

    return lock?.is_locked === true;
  }

  /**
   * The month's lock state as clients render it (KAN-80/KAN-83).
   *
   * A reopened row keeps its stale `locked_at`, so the timestamp is only
   * reported while the lock is actually in force — an open month always reads
   * `lockedAt: null` whatever its history.
   */
  async getLockStatus(year: number, month: number): Promise<MonthLockStatus> {
    const lock = await this.prisma.monthLock.findUnique({
      where: { year_month: { year, month } },
      select: { is_locked: true, locked_at: true },
    });

    if (lock?.is_locked !== true) {
      return { isLocked: false, lockedAt: null };
    }

    return { isLocked: true, lockedAt: lock.locked_at.toISOString() };
  }

  /**
   * Throws 403 with VAL-34 when the month is closed.
   *
   * Called by every TimeEntry write — create, update, and delete — and, on an
   * edit that moves an entry across a month boundary, for both the month it
   * left and the month it lands in.
   */
  async assertMonthNotLocked(year: number, month: number): Promise<void> {
    if (await this.isMonthLocked(year, month)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Forbidden',
        error: 'Forbidden',
        details: [
          {
            field: 'date',
            rule: 'VAL-34',
            message: VAL_MESSAGES['VAL-34'],
          },
        ],
      });
    }
  }
}
