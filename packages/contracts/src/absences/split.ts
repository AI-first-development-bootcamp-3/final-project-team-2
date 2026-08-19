import { LOCAL_DATE_PATTERN } from '../day-status/local-date.js';

/**
 * Weekend handling for absence ranges (VAL-43).
 *
 * The Israeli working week runs Sunday to Thursday, so Friday and Saturday are
 * never absence days. Rather than storing a range that spans a weekend and
 * asking every reader to remember to exclude those days, a reported range is
 * split into one row per contiguous run of working days. The stored rows are
 * then literally true, and `isCoveredByAbsence` — which is a plain inclusive
 * range check — cannot report a Friday as an absence by omission.
 *
 * Israeli holidays are deliberately not handled (GENERAL_SPEC §8.4).
 */

/** A `YYYY-MM-DD` range, both bounds inclusive. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parses a `YYYY-MM-DD` local date as UTC midnight.
 *
 * A date-only value has no time zone of its own, so pinning it to UTC keeps the
 * arithmetic below immune to DST: adding 24 hours to a UTC midnight always
 * lands on the next UTC midnight, which is not true of a local one.
 */
function toUtcMidnight(localDate: string): Date {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    throw new RangeError(`Expected a YYYY-MM-DD local date, received "${localDate}"`);
  }

  const instant = new Date(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Not a real calendar date: "${localDate}"`);
  }

  // `2026-02-30` parses to March 2nd rather than failing, so round-trip the
  // value and reject anything the Date constructor silently moved.
  if (instant.toISOString().slice(0, 10) !== localDate) {
    throw new RangeError(`Not a real calendar date: "${localDate}"`);
  }

  return instant;
}

function toLocalDateString(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * Whether a `YYYY-MM-DD` date falls on a Friday or a Saturday.
 *
 * Read off the UTC weekday of the date pinned to UTC midnight, so the answer
 * depends only on the calendar date and never on the reader's time zone.
 */
export function isWeekend(localDate: string): boolean {
  const day = toUtcMidnight(localDate).getUTCDay();
  return day === 5 || day === 6;
}

/** Every date in an inclusive range, in order. */
function eachDate(startDate: string, endDate: string): string[] {
  const start = toUtcMidnight(startDate);
  const end = toUtcMidnight(endDate);

  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    dates.push(toLocalDateString(new Date(t)));
  }

  return dates;
}

/**
 * Splits an inclusive range into one range per contiguous run of working days.
 *
 * A Thursday-to-Sunday report yields two ranges — the Thursday and the Sunday —
 * and the weekend between them is simply absent from the result. A range with
 * no working days at all yields an empty array; callers reject that as VAL-43
 * rather than storing nothing silently.
 *
 * Returns ranges rather than individual dates so a Sunday-to-Thursday absence
 * stays one row instead of five.
 */
export function splitIntoWorkingRuns(startDate: string, endDate: string): DateRange[] {
  if (toUtcMidnight(endDate).getTime() < toUtcMidnight(startDate).getTime()) {
    return [];
  }

  const runs: DateRange[] = [];
  let current: DateRange | null = null;

  for (const date of eachDate(startDate, endDate)) {
    if (isWeekend(date)) {
      // The run ends here; the next working day starts a new one.
      current = null;
      continue;
    }

    if (current === null) {
      current = { startDate: date, endDate: date };
      runs.push(current);
    } else {
      current.endDate = date;
    }
  }

  return runs;
}

/** Whether an inclusive range contains at least one working day. */
export function hasWorkingDay(startDate: string, endDate: string): boolean {
  return splitIntoWorkingRuns(startDate, endDate).length > 0;
}
