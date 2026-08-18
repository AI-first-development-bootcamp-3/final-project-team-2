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
 * Minutes a single entry contributes.
 *
 * A running entry contributes nothing: work in progress must not inflate the
 * day, and VAL-31 has not yet been applied to it.
 */
function entryMinutes(entry: DayStatusEntry): number {
  if (entry.endAt === undefined || entry.endAt === null) {
    return 0;
  }

  const start = toDate(entry.startAt);
  const end = toDate(entry.endAt);
  const elapsed = end.getTime() - start.getTime();

  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return 0;
  }

  // Round rather than truncate so a whole-minute entry stays whole through any
  // millisecond dust in the stored instants.
  return Math.round(elapsed / 60_000);
}

/**
 * Whether an entry belongs to the given local day.
 *
 * Attribution is by *start* instant (VAL-38), so a 22:00–06:00 night shift
 * counts entirely on the day it began and contributes nothing to the next day.
 */
function startsOn(entry: DayStatusEntry, date: string): boolean {
  return toLocalDate(toDate(entry.startAt)) === date;
}

/** Total reported minutes attributed to one local day. */
export function minutesForDay(entries: readonly DayStatusEntry[], date: string): number {
  return entries.reduce(
    (total, entry) => (startsOn(entry, date) ? total + entryMinutes(entry) : total),
    0,
  );
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
