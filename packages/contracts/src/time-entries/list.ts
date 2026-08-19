import { z } from 'zod';
import { LOCAL_DATE_PATTERN, isRealCalendarDate } from '../day-status/local-date.js';
import { TimeEntryLocationSchema } from './fields.js';

/**
 * A `YYYY-MM-DD` query parameter.
 *
 * Every failure reports VAL-DATE-RANGE, the wrong-typed case included: a
 * duplicated parameter (`?date=a&date=b`) arrives from Express as an array, and
 * on zod's default that surfaced a raw English message under the catch-all
 * `VAL-QUERY` rule, which has no Hebrew entry in `VAL_MESSAGES`.
 *
 * Calendar reality is checked too, not just shape. The write path is
 * backstopped by VAL-38's cross-check against `startAt`; the read path has no
 * such backstop, and `new Date('2026-02-30')` silently returns 2 March.
 */
const localDateQuery = z
  .string({ required_error: 'VAL-DATE-RANGE', invalid_type_error: 'VAL-DATE-RANGE' })
  .regex(LOCAL_DATE_PATTERN, { message: 'VAL-DATE-RANGE' })
  .refine(isRealCalendarDate, { message: 'VAL-DATE-RANGE' });

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

      // `YYYY-MM-DD` sorts lexicographically in date order.
      if (value.to < value.from) {
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
 * once to total it.
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
