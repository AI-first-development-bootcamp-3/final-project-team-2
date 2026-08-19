import { z } from 'zod';
import { toLocalDateOrNull } from './local-date.js';

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

/**
 * A half-day absence leaves four and a half hours still owed.
 *
 * This resolves OQ-04: the half-day split is expressed as a reduced *target*,
 * not as phantom reported hours. A half-day absence therefore does not claim
 * the day — the employee is still prompted for the hours they owe — while a
 * full-day absence keeps its absolute precedence (D3).
 */
export const HALF_DAY_MINUTES = 270;

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
  /**
   * Whether the absence covers only half the day (D3). Optional, and absent is
   * read as a full day, so callers written before the Absences epic keep their
   * existing meaning and compile unchanged.
   *
   * Which half it is does not affect the target: morning and afternoon both
   * leave the same 4h30 owed, so the period is a reporting detail rather than a
   * day-status input.
   */
  isHalfDay?: boolean;
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
  /**
   * Minutes the day expects: 540 ordinarily, 270 under one half-day absence, 0
   * when an absence covers the whole day. Callers size the quota bar against
   * this rather than against `FULL_DAY_MINUTES`, so a half-day is not shown as
   * half-empty (D3).
   */
  targetMinutes: number;
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
 * Deliberately not rounded here. Rounding each entry and then summing lets
 * sub-minute durations distort the day: 08:00:30-17:00:00 is 539.5 real minutes
 * but rounds to 540, reporting an under-nine-hour day as `full` — precisely the
 * boundary `FULL_DAY_MINUTES` exists to protect — while a 29-second entry
 * rounds to 0 and leaves the day reading `empty` with a row on screen. The day
 * total is rounded once instead, in `minutesForDay`.
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
 * An unparseable `startAt` excludes the entry rather than throwing. This runs
 * over rows the server supplied and the client apps do not re-validate, so one
 * bad row has to degrade to "not this day": throwing here would blank the whole
 * quota bar or monthly calendar from two layers below the component, and a bad
 * `endAt` on the same row is already tolerated as zero minutes.
 */
function startsOn(entry: DayStatusEntry, date: string): boolean {
  return toLocalDateOrNull(toDate(entry.startAt)) === date;
}

/**
 * Total reported minutes attributed to one local day.
 *
 * Accumulates milliseconds and converts once, so the boundary is decided on the
 * day's true duration rather than on a sum of per-entry roundings — two
 * thirty-second entries total one minute here, not two.
 *
 * Truncated rather than rounded, because rounding can only ever manufacture
 * minutes that were not worked: 8h59m30s would round up to 540 and report an
 * under-nine-hour day as `full`, the one boundary `FULL_DAY_MINUTES` exists to
 * protect. Truncating keeps the spec's ladder intact — 8h59 partial, exactly 9h
 * full, 9h01 excess — and only ever discards a sub-minute remainder.
 */
export function minutesForDay(entries: readonly DayStatusEntry[], date: string): number {
  const totalMs = entries.reduce(
    (total, entry) => (startsOn(entry, date) ? total + entryMilliseconds(entry) : total),
    0,
  );

  return Math.floor(totalMs / 60_000);
}

/** Whether one absence covers the given local day. Both bounds are inclusive. */
function covers(absence: DayStatusAbsence, date: string): boolean {
  // `YYYY-MM-DD` sorts lexicographically in date order, so string comparison is
  // a correct range check and avoids re-parsing into instants.
  return absence.startDate <= date && date <= absence.endDate;
}

/**
 * Whether any absence — half-day or full — covers the given local day.
 *
 * Note this answers "is there an absence here", not "is the day off": a single
 * half-day absence covers the day in this sense while still leaving 4h30 owed.
 * `targetMinutesForDay` is what decides the day's expectations.
 */
export function isCoveredByAbsence(absences: readonly DayStatusAbsence[], date: string): boolean {
  return absences.some((absence) => covers(absence, date));
}

/**
 * Minutes the given day expects, after the absences covering it (D3).
 *
 * The ladder is ordered by precedence:
 *   - no absence            → a full nine-hour day
 *   - any full-day absence  → nothing owed; it outranks a half-day on the same
 *                             date, so the two together still yield 0
 *   - two or more half-days → the halves account for the whole day
 *   - one half-day          → half the day still owed
 */
export function targetMinutesForDay(absences: readonly DayStatusAbsence[], date: string): number {
  const covering = absences.filter((absence) => covers(absence, date));

  if (covering.length === 0) {
    return FULL_DAY_MINUTES;
  }

  if (covering.some((absence) => absence.isHalfDay !== true)) {
    return 0;
  }

  if (covering.length > 1) {
    return 0;
  }

  return HALF_DAY_MINUTES;
}

/**
 * Classifies one Asia/Jerusalem day.
 *
 * An absence covering the whole day outranks the hour count — a day off that
 * was partly worked still reads as an absence — but the hours are reported
 * either way so callers can show both. A half-day absence instead halves the
 * target and the day classifies on hours as usual, so the four hour-based
 * statuses keep their meanings against whatever the day actually expects.
 */
export function computeDayStatus(input: DayStatusInput): DayStatusResult {
  const { date, entries, absences = [] } = input;

  const totalMinutes = minutesForDay(entries, date);
  const totalHours = totalMinutes / 60;
  const targetMinutes = targetMinutesForDay(absences, date);

  // Only an absence accounting for the whole day drives the target to zero, so
  // this is the old "covered by an absence" branch, narrowed to full days.
  if (targetMinutes === 0) {
    return { status: 'absence', totalMinutes, totalHours, targetMinutes };
  }

  if (totalMinutes === 0) {
    return { status: 'empty', totalMinutes, totalHours, targetMinutes };
  }

  if (totalMinutes < targetMinutes) {
    return { status: 'partial', totalMinutes, totalHours, targetMinutes };
  }

  if (totalMinutes === targetMinutes) {
    return { status: 'full', totalMinutes, totalHours, targetMinutes };
  }

  return { status: 'excess', totalMinutes, totalHours, targetMinutes };
}
