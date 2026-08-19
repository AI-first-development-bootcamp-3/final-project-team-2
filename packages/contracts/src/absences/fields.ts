import { z } from 'zod';
import { AbsenceType, HalfDayPeriod } from '../enums.js';
import { LOCAL_DATE_PATTERN } from '../day-status/local-date.js';
import { isWeekend } from './split.js';

/**
 * Field schemas and cross-field rules shared by the create body, the update
 * body, and the API's merged re-validation on edit — so an edit cannot be held
 * to a weaker standard than a create.
 */

/**
 * Absence type (VAL-40).
 *
 * One error map covers missing, wrong-typed, and out-of-set values: from the
 * employee's point of view they are the same problem, no valid type chosen.
 */
export const AbsenceTypeSchema = z.enum(AbsenceType.options, {
  errorMap: () => ({ message: 'VAL-40' }),
});

/**
 * Whether a `YYYY-MM-DD` string names a day that exists.
 *
 * The pattern alone is not enough: `2026-02-30` matches it, and the Date
 * constructor silently rolls it forward to March 2nd rather than failing. A
 * date-only value is pinned to UTC so the round-trip is not perturbed by any
 * local offset.
 */
export function isRealCalendarDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  const instant = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` first day of the absence (VAL-41). */
export const AbsenceStartDateSchema = z
  .string({ required_error: 'VAL-41', invalid_type_error: 'VAL-41' })
  .min(1, { message: 'VAL-41' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-41' })
  .refine(isRealCalendarDate, { message: 'VAL-41' });

/**
 * `YYYY-MM-DD` last day of the absence, inclusive (VAL-42).
 *
 * A malformed value reports VAL-42 rather than VAL-41: VAL-41 is specifically
 * "start is required", and pointing the employee at the wrong field would be
 * worse than a slightly generic message on the right one.
 */
export const AbsenceEndDateSchema = z
  .string({ required_error: 'VAL-42', invalid_type_error: 'VAL-42' })
  .min(1, { message: 'VAL-42' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-42' })
  .refine(isRealCalendarDate, { message: 'VAL-42' });

export const AbsenceNotesSchema = z.string().trim().max(2000).optional();

export interface AbsenceRangeFields {
  startDate?: string | undefined;
  endDate?: string | undefined;
  isHalfDay?: boolean | undefined;
  halfDayPeriod?: HalfDayPeriod | null | undefined;
}

/**
 * A date string usable by the cross-field rules below.
 *
 * Zod runs object-level refinements even when individual fields failed their
 * own validation, so a malformed or impossible date still reaches them. The
 * field schemas already report those, and the splitter throws on them, so they
 * are screened out here rather than piling a derived complaint on top.
 */
function usableDate(value: string | undefined): string | null {
  if (value === undefined || !isRealCalendarDate(value)) {
    return null;
  }

  return value;
}

/**
 * Applies VAL-42, VAL-43, and the half-day rules to whatever fields are present.
 *
 * Each rule needs all of its operands, so a partial update is only checked on
 * what it actually supplies; the API re-runs this against the merged absence so
 * a half-supplied edit is still fully validated. Operands that failed their own
 * field validation are skipped — VAL-41 and VAL-42 already report those, and
 * piling a derived complaint on top would only obscure the real problem.
 */
export function refineAbsenceRange(value: AbsenceRangeFields, ctx: z.RefinementCtx): void {
  const startDate = usableDate(value.startDate);
  const endDate = usableDate(value.endDate);
  const isHalfDay = value.isHalfDay === true;

  // A half day describes one date, so the period is meaningless without one and
  // the flag is meaningless with a range.
  if (isHalfDay && (value.halfDayPeriod === undefined || value.halfDayPeriod === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['halfDayPeriod'],
      message: 'VAL-ABSENCE-HALF-DAY',
    });
  }

  if (!isHalfDay && value.halfDayPeriod !== undefined && value.halfDayPeriod !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['halfDayPeriod'],
      message: 'VAL-ABSENCE-HALF-DAY',
    });
  }

  if (startDate !== null && endDate !== null) {
    if (endDate < startDate) {
      // `YYYY-MM-DD` sorts lexicographically in date order, so a string
      // comparison is a correct range check without re-parsing to instants.
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'VAL-42' });
      return;
    }

    if (isHalfDay && endDate !== startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'VAL-ABSENCE-HALF-DAY',
      });
    }
  }

  // VAL-43 — Friday and Saturday are never absence days. Each bound is reported
  // against its own field so the form can mark the one the employee must change.
  // A weekend-only range fails on both bounds, which is the honest answer: both
  // are wrong. Any range whose bounds are working days necessarily contains at
  // least those two, so there is no separate "covers nothing" case to check.
  if (startDate !== null && isWeekend(startDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'VAL-43' });
  }

  if (endDate !== null && isWeekend(endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'VAL-43' });
  }
}
