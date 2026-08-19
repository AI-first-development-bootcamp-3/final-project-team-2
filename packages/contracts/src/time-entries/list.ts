import { z } from 'zod';
import { nonAborting } from '../common/non-aborting.js';
import { LOCAL_DATE_PATTERN, isCalendarDate } from '../day-status/local-date.js';
import { TimeEntryLocationSchema } from './fields.js';

/**
 * Widest range a single read may ask for.
 *
 * The consumers are the daily screen (one day) and the monthly calendar (one
 * month), so a year plus a leap day is generous. The cap is what keeps the
 * unpaged response bounded: without it one schema-valid request could ask for
 * every entry an employee ever recorded, each carrying a three-level
 * task→project→client join.
 */
export const MAX_TIME_ENTRY_RANGE_DAYS = 366;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Shape *and* calendar validity — a regex alone lets `2026-13-01` through to
 * `new Date()`, which answers with an Invalid Date, and `2026-02-30`, which
 * quietly becomes March 2.
 *
 * The type errors are spelled out because this is a *query* parameter: Express
 * hands a duplicated `?date=a&date=b` over as an array, and the default zod
 * message for that is raw English under the `VAL-QUERY` fallback rule, which
 * has no Hebrew entry. Wrapped so a bad value cannot abort the object and skip
 * the range rules below.
 */
const localDateQuery = nonAborting(
  z
    .string({ required_error: 'VAL-DATE-RANGE', invalid_type_error: 'VAL-DATE-RANGE' })
    .regex(LOCAL_DATE_PATTERN, { message: 'VAL-DATE-RANGE' })
    .refine(isCalendarDate, { message: 'VAL-DATE-RANGE' }),
);

/** Inclusive day count between two dates already known to be real. */
function rangeLengthInDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return (end - start) / MS_PER_DAY + 1;
}

/**
 * Reads take either a single day or an inclusive range.
 *
 * The range form is here from the start because the monthly calendar needs the
 * same rows for a whole month (KAN-80); giving it now avoids a second endpoint
 * that would have to repeat the scoping and denormalisation rules.
 */
export const TimeEntriesListQuerySchema = z
  .object({
    date: localDateQuery.optional(),
    from: localDateQuery.optional(),
    to: localDateQuery.optional(),
  })
  .superRefine((value, ctx) => {
    const hasSingle = value.date !== undefined;
    const hasRange = value.from !== undefined || value.to !== undefined;

    if (hasSingle && hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'VAL-DATE-RANGE',
      });
      return;
    }

    if (!hasSingle && !hasRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'VAL-DATE-RANGE',
      });
      return;
    }

    if (hasRange) {
      // A half-open range is ambiguous — require both ends rather than guessing.
      if (value.from === undefined || value.to === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [value.from === undefined ? 'from' : 'to'],
          message: 'VAL-DATE-RANGE',
        });
        return;
      }

      // A value that failed its own schema passes through raw, and comparing
      // that would be meaningless — VAL-DATE-RANGE has already been reported
      // against it.
      if (typeof value.from !== 'string' || typeof value.to !== 'string') {
        return;
      }

      // `YYYY-MM-DD` sorts lexicographically in date order.
      if (value.to < value.from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: 'VAL-DATE-RANGE',
        });
        return;
      }

      // The response is unpaged by design (see below), so the width of the
      // range is the only thing bounding its size.
      if (rangeLengthInDays(value.from, value.to) > MAX_TIME_ENTRY_RANGE_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: 'VAL-DATE-RANGE',
        });
      }
    }
  });

/**
 * One entry as returned to the employee.
 *
 * Task, project, and client names are denormalised so a historical entry still
 * renders after its task is closed or its client deactivated (§8.3) — the
 * picker hides those, but the history must keep showing them.
 *
 * The task-side fields are nullable because a running entry has no task yet
 * (§8.6); this epic never creates one, but the read path tolerates it so the
 * Punch Clock epic does not have to revisit this shape.
 */
export const TimeEntryListItemSchema = z.object({
  id: z.string().uuid(),
  /** `YYYY-MM-DD` local day the entry belongs to. */
  date: z.string().regex(LOCAL_DATE_PATTERN),
  /** ISO 8601 UTC instant. */
  startAt: z.string().datetime({ offset: true }),
  /** ISO 8601 UTC instant, or null while the entry is still running. */
  endAt: z.string().datetime({ offset: true }).nullable(),
  location: TimeEntryLocationSchema.nullable(),
  description: z.string().nullable(),
  taskId: z.string().uuid().nullable(),
  taskName: z.string().nullable(),
  projectId: z.string().uuid().nullable(),
  projectName: z.string().nullable(),
  clientId: z.string().uuid().nullable(),
  clientName: z.string().nullable(),
});

/**
 * Entries are returned unpaged: a day holds a handful and a month a few dozen,
 * and both the daily screen and the monthly calendar need the whole period at
 * once to total it. Paging is the wrong tool here — a half-delivered period
 * would total wrongly and say nothing about it — so the size is bounded at the
 * query instead, by `MAX_TIME_ENTRY_RANGE_DAYS`.
 */
export const TimeEntriesListSuccessSchema = z.object({
  data: z.array(TimeEntryListItemSchema),
});

export const TimeEntrySuccessSchema = z.object({
  data: TimeEntryListItemSchema,
});

export type TimeEntriesListQuery = z.infer<typeof TimeEntriesListQuerySchema>;
export type TimeEntryListItem = z.infer<typeof TimeEntryListItemSchema>;
export type TimeEntriesListSuccess = z.infer<typeof TimeEntriesListSuccessSchema>;
export type TimeEntrySuccess = z.infer<typeof TimeEntrySuccessSchema>;
