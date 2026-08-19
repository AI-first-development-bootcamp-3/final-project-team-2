import { Injectable } from '@nestjs/common';
import type { MonthQueryResponse } from '@abra/contracts';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { MonthLockService } from '../time-entries/month-lock.service';
import { monthDateRange } from './month-date-range';

/**
 * The monthly calendar's read model (KAN-80): one call returns everything the
 * screen needs for a month — entries, absences, and lock status — so the
 * client never assembles a month from separate requests.
 *
 * The entries read delegates to the time-entries list, inheriting its caller
 * scoping and §8.3 name denormalisation rather than repeating them. Absences
 * stay an empty array until the Absences epic ships the model; the key is part
 * of the contract from day one so that arrival changes no shapes.
 */
@Injectable()
export class MonthsService {
  constructor(
    private readonly timeEntries: TimeEntriesService,
    private readonly monthLock: MonthLockService,
  ) {}

  async getMonth(userId: string, year: number, month: number): Promise<MonthQueryResponse['data']> {
    const { from, to } = monthDateRange(year, month);

    const [entries, lock] = await Promise.all([
      this.timeEntries.list(userId, { from, to }),
      this.monthLock.getLockStatus(year, month),
    ]);

    return { entries, absences: [], lock };
  }
}
