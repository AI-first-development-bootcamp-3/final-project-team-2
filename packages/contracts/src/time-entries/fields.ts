import { z } from 'zod';
import { nonAborting } from '../common/non-aborting.js';
import { LOCAL_DATE_PATTERN, isCalendarDate, toLocalDate } from '../day-status/local-date.js';
import { WorkLocation } from '../enums.js';

/**
 * Field schemas and cross-field rules shared by the create body, the update
 * body, and the API's merged re-validation on edit — so an edit cannot be held
 * to a weaker standard than a create.
 *
 * Every field is exported through `nonAborting`, which is what lets the
 * cross-field rules below run even when a field is missing or wrong-typed.
 * The unwrapped `Base*` schemas stay private and are the authority those rules
 * consult before trusting a value.
 */

/**
 * Work location (VAL-36).
 *
 * Derived from `WorkLocation` rather than re-declaring the literals, so a
 * location added to the wire enum cannot be rejected here as invalid. One
 * error map covers missing, wrong-typed, and out-of-set values: from the
 * employee's point of view they are the same problem, no valid location chosen.
 */
const BaseLocationSchema = z.enum(WorkLocation.options, {
  errorMap: () => ({ message: 'VAL-36' }),
});

/**
 * `YYYY-MM-DD`, the local day the entry belongs to (VAL-38).
 *
 * Calendar validity is checked alongside the shape so `2026-02-30` is refused
 * here rather than rolling over to March 2 downstream: `toYearMonth` and the
 * date column both assume a real date.
 */
const BaseDateSchema = z
  .string({ required_error: 'VAL-38', invalid_type_error: 'VAL-38' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-38' })
  .refine(isCalendarDate, { message: 'VAL-38' });

/** Task reference (VAL-35). Required for any completed entry. */
const BaseTaskIdSchema = z
  .string({ required_error: 'VAL-35', invalid_type_error: 'VAL-35' })
  .uuid({ message: 'VAL-35' });

/**
 * Instants accept a trailing `Z` or an explicit offset. The API answers in UTC
 * (§8.5), but a client sending `+03:00` is unambiguous and worth accepting.
 */
const BaseStartAtSchema = z
  .string({ required_error: 'VAL-30', invalid_type_error: 'VAL-30' })
  .min(1, { message: 'VAL-30' })
  .datetime({ offset: true, message: 'VAL-30' });

const BaseEndAtSchema = z
  .string({ required_error: 'VAL-31', invalid_type_error: 'VAL-31' })
  .min(1, { message: 'VAL-31' })
  .datetime({ offset: true, message: 'VAL-31' });

export const TimeEntryLocationSchema = nonAborting(BaseLocationSchema);
export const TimeEntryDateSchema = nonAborting(BaseDateSchema);
export const TimeEntryTaskIdSchema = nonAborting(BaseTaskIdSchema);
export const TimeEntryStartAtSchema = nonAborting(BaseStartAtSchema);
export const TimeEntryEndAtSchema = nonAborting(BaseEndAtSchema);

/**
 * What the cross-field rules read.
 *
 * Typed as `unknown` deliberately: a field that failed its own schema passes
 * its raw value through, so these rules must not assume anything about shape.
 */
export interface TimeEntryTimes {
  date?: unknown;
  startAt?: unknown;
  endAt?: unknown;
}

/**
 * Parses an instant, but only from a value that passed its own field schema.
 *
 * Checking the schema rather than `new Date()` is the whole point: `2026-08-09`
 * fails VAL-30 as an instant yet parses happily as a date, so a `new Date()`
 * guard would let the rules below stack derived VAL-31 and VAL-38 complaints on
 * top of the real error — three field errors for one bad input.
 */
function checkedInstant(
  value: unknown,
  schema: z.ZodType<string, z.ZodTypeDef, unknown>,
): Date | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    return null;
  }

  const instant = new Date(result.data);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Whether an entry is still running, and so exempt from VAL-31 (§8.6). */
export function isRunning(endAt: unknown): boolean {
  return endAt === undefined || endAt === null;
}

/**
 * Applies VAL-31 and VAL-38 to whatever times are present.
 *
 * Each rule needs both of its operands, so a partial update is only checked on
 * the pairs it actually supplies; the API re-runs this against the merged entry
 * so a half-supplied edit is still fully validated. Operands that failed their
 * own field validation are skipped — VAL-30 and VAL-31 already report those,
 * and piling a derived complaint on top would only obscure the real problem.
 *
 * A running entry has no end time and is exempt from VAL-31 (§8.6); this epic
 * never creates one, but the Punch Clock epic inherits these rules.
 */
export function refineTimeEntryTimes(value: TimeEntryTimes, ctx: z.RefinementCtx): void {
  const startAt = checkedInstant(value.startAt, BaseStartAtSchema);
  const endAt = isRunning(value.endAt) ? null : checkedInstant(value.endAt, BaseEndAtSchema);
  const date = BaseDateSchema.safeParse(value.date);

  if (startAt !== null && endAt !== null) {
    // Comparing instants rather than clock times is what lets a 22:00–06:00
    // night shift through while still rejecting a backwards entry.
    if (endAt.getTime() <= startAt.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'VAL-31' });
    }
  }

  if (startAt !== null && date.success) {
    // VAL-38 — the entry belongs to the day it started, in Asia/Jerusalem.
    if (toLocalDate(startAt) !== date.data) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'VAL-38' });
    }
  }
}
