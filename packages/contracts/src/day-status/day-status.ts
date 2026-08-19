import { z } from 'zod';
import { toLocalDate } from './local-date.js';

/**
 * Day status is computed, never stored (§2.4), and the rules live here alone so
 * the daily quota bar and the monthly calendar cannot disagree about whether a
 * day is full.
 */
export const DayStatus = z.enum(['empty', 'partial', 'full', 'excess', 'absence']);
export type DayStatus = z.infer<typeof DayStatus>;

/**
 * A full day is exactly nine hours.
 *
 * GENERAL_SPEC §2.4 defines `full` as ">= 9" while §8.5 defines it as exactly
 * 9; under §2.4 a ten-hour day would be both `full` and `excess`. We follow
 * §8.5 (and KAN-74), which leaves the four hour-based statuses mutually
 * exclusive. Held in whole minutes: summing fractional hours makes an exact
 * match unreliable, so `2.5h + 6.5h` would not dependably land on `full`.
 */
export const FULL_DAY_MINUTES = 540;

/** The shape day-status needs from a time entry. */
export interface DayStatusEntry {
  /** UTC instant the entry started. */
  startAt: Date | string;
  /** UTC instant it ended; absent or null means still running (§8.6). */
  endAt?: Date | string | null;
}

/** The shape day-status needs from an absence. Both bounds are inclusive. */
export interface DayStatusAbsence {
  /** `YYYY-MM-DD` local date. */
  startDate: string;
  /** `YYYY-MM-DD` local date. */
  endDate: string;
}

export interface DayStatusInput {
  /** The `YYYY-MM-DD` Asia/Jerusalem day being classified. */
  date: string;
  entries: readonly DayStatusEntry[];
  /**
   * Absences overlapping the day. The Absences epic supplies these; until then
   * callers pass an empty array and `absence` is simply never returned.
   */
  absences?: readonly DayStatusAbsence[];
}

export interface DayStatusResult {
  status: DayStatus;
  /** Total reported minutes, excluding any still-running entry. */
  totalMinutes: number;
  /** The same total in hours, for display. */
  totalHours: number;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Milliseconds a single entry contributes.
 *
 * A running entry contributes nothing: work in progress must not inflate the
 * day, and VAL-31 has not yet been applied to it.
 *
 * Deliberately *not* rounded to minutes here. Rounding per entry both loses
 * sub-minute work — two 30-second entries totalled 2 minutes against a true
 * total of 1 — and rounds a 539.5-minute day up onto the exact 540 boundary
 * this module exists to protect. Seconds arrive once the Punch Clock epic
 * writes real timestamps (D7); the day is the only level at which rounding is
 * safe.
 */
function entryMilliseconds(entry: DayStatusEntry): number {
  if (entry.endAt === undefined || entry.endAt === null) {
    return 0;
  }

  const start = toDate(entry.startAt);
  const end = toDate(entry.endAt);
  const elapsed = end.getTime() - start.getTime();

  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return 0;
  }

  return elapsed;
}

/**
 * Whether an entry belongs to the given local day.
 *
 * Attribution is by *start* instant (VAL-38), so a 22:00–06:00 night shift
 * counts entirely on the day it began and contributes nothing to the next day.
 *
 * An unparseable start belongs to no day at all. It is skipped rather than
 * thrown on, because these functions run inside render: the client apps never
 * runtime-validate API responses, so one bad instant used to take out the whole
 * quota bar or monthly calendar with a `RangeError` raised two layers below the
 * component. An unusable `endAt` already degraded quietly; this makes the two
 * ends consistent.
 */
function startsOn(entry: DayStatusEntry, date: string): boolean {
  const start = toDate(entry.startAt);
  if (Number.isNaN(start.getTime())) {
    return false;
  }

  return toLocalDate(start) === date;
}

/**
 * Total reported minutes attributed to one local day.
 *
 * Summed in milliseconds and floored once, at the end. Flooring rather than
 * rounding keeps the promise the statuses make: 8h59m30s is `partial`, because
 * a day that was not worked in full must never read as `full`.
 */
export function minutesForDay(entries: readonly DayStatusEntry[], date: string): number {
  const elapsed = entries.reduce(
    (total, entry) => (startsOn(entry, date) ? total + entryMilliseconds(entry) : total),
    0,
  );

  return Math.floor(elapsed / 60_000);
}

/** Whether an absence covers the given local day. Both bounds are inclusive. */
export function isCoveredByAbsence(absences: readonly DayStatusAbsence[], date: string): boolean {
  // `YYYY-MM-DD` sorts lexicographically in date order, so string comparison is
  // a correct range check and avoids re-parsing into instants.
  return absences.some((absence) => absence.startDate <= date && date <= absence.endDate);
}

/**
 * Classifies one Asia/Jerusalem day.
 *
 * An absence outranks the hour count — a day off that was partly worked still
 * reads as an absence — but the hours are reported either way so callers can
 * show both.
 */
export function computeDayStatus(input: DayStatusInput): DayStatusResult {
  const { date, entries, absences = [] } = input;

  const totalMinutes = minutesForDay(entries, date);
  const totalHours = totalMinutes / 60;

  if (isCoveredByAbsence(absences, date)) {
    return { status: 'absence', totalMinutes, totalHours };
  }

  if (totalMinutes === 0) {
    return { status: 'empty', totalMinutes, totalHours };
  }

  if (totalMinutes < FULL_DAY_MINUTES) {
    return { status: 'partial', totalMinutes, totalHours };
  }

  if (totalMinutes === FULL_DAY_MINUTES) {
    return { status: 'full', totalMinutes, totalHours };
  }

  return { status: 'excess', totalMinutes, totalHours };
}
