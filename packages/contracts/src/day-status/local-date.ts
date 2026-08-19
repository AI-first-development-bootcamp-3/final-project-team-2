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

/** Whether two instants fall on the same Asia/Jerusalem calendar day. */
export function isSameLocalDate(a: Date, b: Date): boolean {
  return toLocalDate(a) === toLocalDate(b);
}

/**
 * Whether a `YYYY-MM-DD` string names a day that actually exists.
 *
 * `LOCAL_DATE_PATTERN` only proves the shape, and `new Date()` is forgiving in
 * two different, both-wrong ways: `2026-13-01` yields an Invalid Date that
 * surfaces as a 500 from whatever consumes it, while `2026-02-30` silently
 * rolls over to March 2 and answers about a day the caller never asked for.
 * Round-tripping the parts is what separates the two from a real date.
 */
export function isCalendarDate(localDate: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    return false;
  }

  const [year, month, day] = localDate.split('-').map(Number) as [number, number, number];
  const instant = new Date(Date.UTC(year, month - 1, day));

  // `Date.UTC` maps years 0–99 onto 1900–1999, so the year has to be compared
  // back too rather than trusting the month and day alone.
  return (
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() === month - 1 &&
    instant.getUTCDate() === day
  );
}

/**
 * Splits a `YYYY-MM-DD` local date into the year and 1-based month that
 * identify a MonthLock row (VAL-34).
 */
export function toYearMonth(localDate: string): { year: number; month: number } {
  if (!isCalendarDate(localDate)) {
    throw new RangeError(`Expected a YYYY-MM-DD local date, received "${localDate}"`);
  }

  const [year, month] = localDate.split('-');
  return { year: Number(year), month: Number(month) };
}
