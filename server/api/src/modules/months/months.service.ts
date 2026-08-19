import { Injectable } from '@nestjs/common';
import type { MonthAbsence, MonthLockStatus, MonthQueryResponse } from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { monthDateRange } from './month-date-range';

/**
 * A `@db.Date` column comes back as UTC midnight on that calendar day, so the
 * ISO date part is exactly the stored day — same reasoning as the time-entries
 * read path.
 */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` local date into the instant a `@db.Date` column stores. */
function toDateColumnValue(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

/**
 * The monthly calendar's read model (KAN-80): one call returns everything the
 * screen needs for a month — entries, absences, and lock status — so the
 * client never assembles a month from separate requests.
 *
 * The entries read delegates to the time-entries list, inheriting its caller
 * scoping and §8.3 name denormalisation rather than repeating them. Absences
 * are the caller's own Absence rows overlapping the month; the rows feed
 * `computeDayStatus` unchanged, and the Absences epic extends the shape
 * additively.
 */
@Injectable()
export class MonthsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  async getMonth(userId: string, year: number, month: number): Promise<MonthQueryResponse['data']> {
    const { from, to } = monthDateRange(year, month);

    const [entries, absences, lock] = await Promise.all([
      this.timeEntries.list(userId, { from, to }),
      this.absencesOverlapping(userId, from, to),
      this.lockStatus(year, month),
    ]);

    return { entries, absences, lock };
  }

  /**
   * The caller's absences overlapping the month, both bounds inclusive: an
   * absence belongs to every month it touches, so one spanning a month
   * boundary shows up in both months.
   *
   * The Prisma soft-delete extension already excludes `deleted_at` rows from
   * every Absence read; the explicit filter keeps the exclusion asserted at
   * the query itself rather than resting on the extension alone.
   */
  private async absencesOverlapping(
    userId: string,
    from: string,
    to: string,
  ): Promise<MonthAbsence[]> {
    const rows = await this.prisma.absence.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        start_date: { lte: toDateColumnValue(to) },
        end_date: { gte: toDateColumnValue(from) },
      },
      select: { start_date: true, end_date: true },
      orderBy: { start_date: 'asc' },
    });

    return rows.map((row) => ({
      startDate: toDateString(row.start_date),
      endDate: toDateString(row.end_date),
    }));
  }

  /**
   * Lock state straight off the MonthLock row (§8.1): no row or
   * `is_locked = false` reads as open — a reopened month's stale `locked_at`
   * is not leaked. The Month Close epic owns the writes; write *enforcement*
   * stays in `MonthLockService`, this is the read the calendar renders from.
   */
  private async lockStatus(year: number, month: number): Promise<MonthLockStatus> {
    const lock = await this.prisma.monthLock.findUnique({
      where: { year_month: { year, month } },
      select: { is_locked: true, locked_at: true },
    });

    if (lock?.is_locked !== true) {
      return { isLocked: false, lockedAt: null };
    }

    return { isLocked: true, lockedAt: lock.locked_at.toISOString() };
  }
}
