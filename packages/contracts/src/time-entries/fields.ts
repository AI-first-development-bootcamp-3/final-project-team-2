import { z } from 'zod';
import { WorkLocation } from '../enums.js';
import { LOCAL_DATE_PATTERN, isRealCalendarDate, toLocalDate } from '../day-status/local-date.js';

/**
 * Field schemas and cross-field rules shared by the create body, the update
 * body, and the API's merged re-validation on edit — so an edit cannot be held
 * to a weaker standard than a create.
 */

/**
 * Work location (VAL-36).
 *
 * Derived from the shared `WorkLocation` enum rather than re-declaring its
 * literals, so a value added there cannot become one this contract rejects.
 * One error map covers missing, wrong-typed, and out-of-set values: from the
 * employee's point of view they are the same problem, no valid location chosen.
 */
export const TimeEntryLocationSchema = z.enum(WorkLocation.options, {
  errorMap: () => ({ message: 'VAL-36' }),
});

/**
 * `YYYY-MM-DD`, the local day the entry belongs to (VAL-38).
 *
 * Checked for calendar reality, not just shape: `2026-02-30` matches the
 * pattern but `new Date` rolls it over to 2 March, and a month of 13 produces a
 * MonthLock key that matches no row and so reads as "month open".
 */
export const TimeEntryDateSchema = z
  .string({ required_error: 'VAL-38', invalid_type_error: 'VAL-38' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-38' })
  .refine(isRealCalendarDate, { message: 'VAL-38' });

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

/**
 * Free-text note. Nullable as well as optional on every body: the list endpoint
 * returns `description: null`, so a client reusing one payload builder for
 * create and edit would otherwise be rejected on create for a value the read
 * path had just handed it.
 */
export const TimeEntryDescriptionSchema = z.string().trim().nullable().optional();

export interface TimeEntryTimes {
  date?: string | undefined;
  startAt?: string | undefined;
  endAt?: string | null | undefined;
}

/** Parses an instant, returning null when it is unusable. */
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
 * Only ever called with operands that passed their own field schema (see
 * `timeEntryBodySchema`), so it cannot derive a complaint from a value that was
 * already rejected — reporting VAL-31 against a `startAt` that failed VAL-30
 * would be three errors for one bad input. Each rule still needs both of its
 * operands, so a partial update is only checked on the pairs it supplies; the
 * API re-runs this against the merged entry so a half-supplied edit is still
 * fully validated.
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

/**
 * Builds a time-entry body schema whose field errors never suppress the
 * cross-field rules.
 *
 * zod v3 abandons an object's `.superRefine` the moment any field parse
 * *aborts*, which a missing or wrong-typed field does — while a merely
 * malformed one of the right type only marks the result dirty and lets the
 * refinement run. That asymmetry meant a body with both a bad location and
 * reversed times reported only the location: the employee fixed it, resubmitted,
 * and only then learned the times were backwards. It also made the spec's "all
 * violations SHALL be reported together" unreachable.
 *
 * So the object itself accepts anything and each field is parsed individually.
 * Field issues are copied in under their own key, and the cross-field rules
 * then run against only those operands that passed — which is also what keeps a
 * rejected `startAt` from spawning derived VAL-31/VAL-38 noise on top of its
 * own VAL-30.
 */
export function timeEntryBodySchema<Shape extends z.ZodRawShape>(
  shape: Shape,
  afterFields?: (raw: Record<string, unknown>, ctx: z.RefinementCtx) => void,
) {
  const fields = z.object(shape);

  return (
    z
      .object({})
      .passthrough()
      .superRefine((raw, ctx) => {
        const supplied = raw as Record<string, unknown>;
        const passed: Record<string, unknown> = {};

        for (const [key, schema] of Object.entries(shape)) {
          const result = schema.safeParse(supplied[key]);

          if (result.success) {
            passed[key] = result.data;
            continue;
          }

          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [key, ...issue.path],
              message: issue.message,
            });
          }
        }

        refineTimeEntryTimes(passed as TimeEntryTimes, ctx);
        afterFields?.(supplied, ctx);
      })
      // Reached only when every field passed above, so this re-parse cannot fail;
      // it exists to hand back the trimmed, typed, unknown-key-stripped value.
      .transform((raw) => fields.parse(raw))
  );
}
