/**
 * Asia/Jerusalem local-date helpers.
 *
 * Timestamps travel as UTC instants (§8.5) but a time entry belongs to the
 * *local* day it started on (VAL-38), so every day-boundary decision in the
 * system routes through here. Built on Intl so the runtime's own tz database
 * handles Israeli DST — the contracts package is imported by the API and by
 * both browser apps, so it must not carry a tz dependency of its own.
 */

export const APP_TIME_ZONE = 'Asia/Jerusalem';

/** `YYYY-MM-DD`, the wire format for date-only fields. */
export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const localDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function assertValidInstant(instant: Date): void {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Invalid Date passed to a local-date helper');
  }
}

/**
 * The Asia/Jerusalem calendar date an instant falls on, as `YYYY-MM-DD`.
 *
 * Assembled from parts rather than by string-slicing a formatted date so the
 * result cannot drift with locale formatting.
 */
export function toLocalDate(instant: Date): string {
  assertValidInstant(instant);

  const parts = localDateParts.formatToParts(instant);
  const find = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) {
      throw new RangeError(`Missing "${type}" part while formatting a local date`);
    }
    return part.value;
  };

  return `${find('year')}-${find('month')}-${find('day')}`;
}

/**
 * The Asia/Jerusalem calendar date an instant falls on, or null when the
 * instant is unusable.
 *
 * `toLocalDate` throws so that a programming error surfaces loudly at the
 * boundary where it happens. Anything iterating over server-supplied rows wants
 * the opposite: one malformed row must not take out the whole computation, so
 * day attribution routes through here instead.
 */
export function toLocalDateOrNull(instant: Date): string | null {
  return Number.isNaN(instant.getTime()) ? null : toLocalDate(instant);
}

/** Whether two instants fall on the same Asia/Jerusalem calendar day. */
export function isSameLocalDate(a: Date, b: Date): boolean {
  return toLocalDate(a) === toLocalDate(b);
}

/**
 * Whether a `YYYY-MM-DD` string names a day that actually exists.
 *
 * `LOCAL_DATE_PATTERN` only checks the shape, so `2026-02-30` and `2026-13-01`
 * both pass it. Both are dangerous downstream: `new Date('2026-02-30')` rolls
 * silently over to 2 March and returns another day's entries as a 200, while
 * `toYearMonth('2026-13-01')` yields month 13 — a MonthLock key nothing can
 * match, which reads as "month open" and would let a write through a lock.
 */
export function isRealCalendarDate(localDate: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    return false;
  }

  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));

  // Round-tripping through UTC catches every rollover: a component the calendar
  // had to normalise comes back out different from what went in.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Splits a `YYYY-MM-DD` local date into the year and 1-based month that
 * identify a MonthLock row (VAL-34).
 */
export function toYearMonth(localDate: string): { year: number; month: number } {
  // Rejects impossible calendar dates too, so a month-lock lookup can never be
  // handed a key like month 13 that silently matches no row.
  if (!isRealCalendarDate(localDate)) {
    throw new RangeError(`Expected a YYYY-MM-DD local date, received "${localDate}"`);
  }

  const [year, month] = localDate.split('-');
  return { year: Number(year), month: Number(month) };
}
