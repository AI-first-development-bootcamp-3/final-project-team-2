import { ForbiddenException, Injectable } from '@nestjs/common';
import { VAL_MESSAGES, requiresDocument, type AbsenceType } from '@abra/contracts';
import { MonthLockService } from '../time-entries/month-lock.service';

/**
 * Operations the locked-month matrix distinguishes (§7.3).
 *
 * `attach` is listed because it is the interesting case: registering a document
 * is permitted in a locked month, which is the whole point of VAL-44 — the note
 * usually arrives after the month has closed.
 */
export type AbsenceOperation = 'create' | 'update' | 'delete' | 'attach';

/**
 * The one employee-side exception to the month lock (§7.3, VAL-45).
 *
 * A locked month refuses every write except: creating a sick or military
 * absence, and attaching a document to an absence that already exists. Both
 * exist because the employee has no control over when the event or its
 * paperwork happens — refusing them would make the rules unusable rather than
 * strict.
 *
 *   operation  type              open     locked
 *   ─────────  ────────────────  ─────    ──────
 *   create     vacation, other   allow    403
 *   create     sick, military    allow    allow
 *   update     any               allow    403
 *   delete     any               allow    403
 *   attach     any               allow    allow
 *
 * Reads are never gated and so are absent from the table.
 */
function isAllowedWhileLocked(operation: AbsenceOperation, type: AbsenceType): boolean {
  switch (operation) {
    case 'attach':
      return true;
    case 'create':
      return requiresDocument(type);
    case 'update':
    case 'delete':
      return false;
  }
}

@Injectable()
export class AbsenceLockService {
  constructor(private readonly monthLock: MonthLockService) {}

  /**
   * Throws 403 with VAL-45 when the month is closed to this operation.
   *
   * Delegates the lock *reading* to `MonthLockService` — the seam the daily
   * reporting epic planted (§8.1) — and owns only the matrix above. The Month
   * Close epic adds the lock/unlock writes without changing either.
   */
  async assertWritable(
    operation: AbsenceOperation,
    type: AbsenceType,
    year: number,
    month: number,
  ): Promise<void> {
    if (isAllowedWhileLocked(operation, type)) {
      return;
    }

    if (!(await this.monthLock.isMonthLocked(year, month))) {
      return;
    }

    throw new ForbiddenException({
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
      details: [
        {
          field: 'startDate',
          rule: 'VAL-45',
          message: VAL_MESSAGES['VAL-45'],
        },
      ],
    });
  }
}

export { isAllowedWhileLocked };
