import { ForbiddenException, Injectable } from '@nestjs/common';
import { valDetail } from '@abra/contracts';
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
        details: [valDetail('date', 'VAL-34')],
      });
    }
  }
}
