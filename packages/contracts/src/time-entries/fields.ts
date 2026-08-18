import { z } from 'zod';
import { LOCAL_DATE_PATTERN, toLocalDate } from '../day-status/local-date.js';

/**
 * Field schemas and cross-field rules shared by the create body, the update
 * body, and the API's merged re-validation on edit — so an edit cannot be held
 * to a weaker standard than a create.
 */

/**
 * Work location (VAL-36).
 *
 * One error map covers missing, wrong-typed, and out-of-set values: from the
 * employee's point of view they are the same problem, no valid location chosen.
 */
export const TimeEntryLocationSchema = z.enum(['office', 'client_site', 'home'], {
  errorMap: () => ({ message: 'VAL-36' }),
});

/** `YYYY-MM-DD`, the local day the entry belongs to (VAL-38). */
export const TimeEntryDateSchema = z
  .string({ required_error: 'VAL-38', invalid_type_error: 'VAL-38' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-38' });

/** Task reference (VAL-35). Required for any completed entry. */
export const TimeEntryTaskIdSchema = z
  .string({ required_error: 'VAL-35', invalid_type_error: 'VAL-35' })
  .uuid({ message: 'VAL-35' });

/**
 * Instants accept a trailing `Z` or an explicit offset. The API answers in UTC
 * (§8.5), but a client sending `+03:00` is unambiguous and worth accepting.
 */
export const TimeEntryStartAtSchema = z
  .string({ required_error: 'VAL-30', invalid_type_error: 'VAL-30' })
  .min(1, { message: 'VAL-30' })
  .datetime({ offset: true, message: 'VAL-30' });

export const TimeEntryEndAtSchema = z
  .string({ required_error: 'VAL-31', invalid_type_error: 'VAL-31' })
  .min(1, { message: 'VAL-31' })
  .datetime({ offset: true, message: 'VAL-31' });

export interface TimeEntryTimes {
  date?: string | undefined;
  startAt?: string | undefined;
  endAt?: string | null | undefined;
}

/**
 * Parses an instant, returning null when it is unusable.
 *
 * Zod runs object-level refinements even when individual fields failed their
 * own validation, so a malformed `startAt` reaches the cross-field rules below.
 * Without this guard the rules would construct an Invalid Date and throw out of
 * `safeParse`, turning a 400 into a 500.
 */
function toInstant(value: string | undefined | null): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * Applies VAL-31 and VAL-38 to whatever times are present.
 *
 * Each rule needs both of its operands, so a partial update is only checked on
 * the pairs it actually supplies; the API re-runs this against the merged entry
 * so a half-supplied edit is still fully validated. Operands that failed their
 * own field validation are skipped — VAL-30 and VAL-31 already report those,
 * and piling a derived complaint on top would only obscure the real problem.
 */
export function refineTimeEntryTimes(value: TimeEntryTimes, ctx: z.RefinementCtx): void {
  const { date } = value;
  const startAt = toInstant(value.startAt);
  const endAt = toInstant(value.endAt);

  if (startAt !== null && endAt !== null) {
    // Comparing instants rather than clock times is what lets a 22:00–06:00
    // night shift through while still rejecting a backwards entry.
    if (endAt.getTime() <= startAt.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'VAL-31' });
    }
  }

  if (startAt !== null && date !== undefined) {
    // VAL-38 — the entry belongs to the day it started, in Asia/Jerusalem.
    if (toLocalDate(startAt) !== date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'VAL-38' });
    }
  }
}
