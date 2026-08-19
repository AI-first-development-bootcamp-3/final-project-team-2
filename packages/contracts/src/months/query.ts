import { z } from 'zod';
import { LOCAL_DATE_PATTERN } from '../day-status/local-date.js';
import { TimeEntryListItemSchema } from '../time-entries/list.js';

/**
 * One absence as the month query returns it.
 *
 * Structurally compatible with `DayStatusAbsence`, so the rows feed
 * `computeDayStatus` unchanged. The Absences epic extends this shape
 * additively (type, half-day, notes); day-status only ever reads the bounds.
 */
export const MonthAbsenceSchema = z.object({
  /** `YYYY-MM-DD` local date, inclusive. */
  startDate: z.string().regex(LOCAL_DATE_PATTERN),
  /** `YYYY-MM-DD` local date, inclusive. */
  endDate: z.string().regex(LOCAL_DATE_PATTERN),
});

/**
 * Lock state as read from the MonthLock row: no row or `is_locked = false`
 * reads as open with `lockedAt: null` (§8.1); the Month Close epic owns the
 * writes.
 */
export const MonthLockStatusSchema = z.object({
  isLocked: z.boolean(),
  /** ISO 8601 UTC instant of the lock, or null while the month is open. */
  lockedAt: z.string().datetime({ offset: true }).nullable(),
});

/**
 * Everything the monthly calendar needs in one response (KAN-80).
 *
 * `absences` is required — not defaulted — so the server cannot silently drop
 * the key: it stays an empty array until the Absences epic fills it, and the
 * contract does not change when that happens.
 */
export const MonthQueryResponseSchema = z.object({
  data: z.object({
    entries: z.array(TimeEntryListItemSchema),
    absences: z.array(MonthAbsenceSchema),
    lock: MonthLockStatusSchema,
  }),
});

export type MonthAbsence = z.infer<typeof MonthAbsenceSchema>;
export type MonthLockStatus = z.infer<typeof MonthLockStatusSchema>;
export type MonthQueryResponse = z.infer<typeof MonthQueryResponseSchema>;
