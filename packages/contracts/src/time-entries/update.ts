import { z } from 'zod';
import {
  TimeEntryDateSchema,
  TimeEntryDescriptionSchema,
  TimeEntryEndAtSchema,
  TimeEntryLocationSchema,
  TimeEntryStartAtSchema,
  TimeEntryTaskIdSchema,
  timeEntryBodySchema,
} from './fields.js';

/** The fields an edit is allowed to carry. */
const UPDATABLE_FIELDS = ['taskId', 'date', 'startAt', 'endAt', 'location', 'description'] as const;

/**
 * Body for editing an entry. Every field is optional so a client can send only
 * what changed.
 *
 * Cross-field rules can only be applied to the pairs actually supplied here —
 * changing `startAt` alone leaves VAL-31 uncheckable at this layer. The API
 * merges the patch onto the stored entry and re-validates the result, so a
 * partial edit is still held to the full rule set (see `MergedTimeEntrySchema`).
 */
export const UpdateTimeEntryBodySchema = timeEntryBodySchema(
  {
    taskId: TimeEntryTaskIdSchema.optional(),
    date: TimeEntryDateSchema.optional(),
    startAt: TimeEntryStartAtSchema.optional(),
    endAt: TimeEntryEndAtSchema.optional(),
    location: TimeEntryLocationSchema.optional(),
    // Explicit null clears the description; omitting it leaves it untouched.
    description: TimeEntryDescriptionSchema,
  },
  (raw, ctx) => {
    if (UPDATABLE_FIELDS.every((field) => raw[field] === undefined)) {
      // Root-scoped on purpose: no single input is at fault. Forms must surface
      // it as a form-level message — keyed by field alone it would be dropped
      // and the save would appear to do nothing.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'VAL-EMPTY-UPDATE',
      });
    }
  },
);

export type UpdateTimeEntryBody = z.infer<typeof UpdateTimeEntryBodySchema>;

/**
 * The authoritative shape an entry must satisfy after a patch is merged onto it.
 *
 * Identical to the create rules, and deliberately so: an edit must not be able
 * to leave an entry in a state a create would have rejected.
 *
 * `endAt` is required here because a running entry never reaches this schema —
 * the service refuses PATCH and DELETE on one outright with VAL-RUNNING-ENTRY
 * (design D7), rather than exempting it from rules and reporting VAL-31 against
 * a field the caller never sent.
 */
export const MergedTimeEntrySchema = timeEntryBodySchema({
  taskId: TimeEntryTaskIdSchema,
  date: TimeEntryDateSchema,
  startAt: TimeEntryStartAtSchema,
  endAt: TimeEntryEndAtSchema,
  location: TimeEntryLocationSchema,
  description: TimeEntryDescriptionSchema,
});

export type MergedTimeEntry = z.infer<typeof MergedTimeEntrySchema>;

/**
 * A merged entry that has been completed — every field a write needs.
 *
 * `MergedTimeEntrySchema` already requires `endAt` / `taskId` / `location`
 * because this epic refuses PATCH/DELETE on a running entry (design D7). The
 * alias exists so the write path and the Punch Clock epic share one name for
 * that completed shape rather than reaching past the refusal.
 */
export const CompletedTimeEntrySchema = MergedTimeEntrySchema;
export type CompletedTimeEntry = MergedTimeEntry;
