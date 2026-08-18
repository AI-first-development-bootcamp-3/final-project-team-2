import { z } from 'zod';
import {
  TimeEntryDateSchema,
  TimeEntryEndAtSchema,
  TimeEntryLocationSchema,
  TimeEntryStartAtSchema,
  TimeEntryTaskIdSchema,
  refineTimeEntryTimes,
} from './fields.js';

/**
 * Body for editing an entry. Every field is optional so a client can send only
 * what changed.
 *
 * Cross-field rules can only be applied to the pairs actually supplied here —
 * changing `startAt` alone leaves VAL-31 uncheckable at this layer. The API
 * merges the patch onto the stored entry and re-validates the result, so a
 * partial edit is still held to the full rule set (see `MergedTimeEntrySchema`).
 */
export const UpdateTimeEntryBodySchema = z
  .object({
    taskId: TimeEntryTaskIdSchema.optional(),
    date: TimeEntryDateSchema.optional(),
    startAt: TimeEntryStartAtSchema.optional(),
    endAt: TimeEntryEndAtSchema.optional(),
    location: TimeEntryLocationSchema.optional(),
    // Explicit null clears the description; omitting it leaves it untouched.
    description: z.string().trim().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    refineTimeEntryTimes(value, ctx);

    if (Object.values(value).every((field) => field === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'VAL-EMPTY-UPDATE',
      });
    }
  });

export type UpdateTimeEntryBody = z.infer<typeof UpdateTimeEntryBodySchema>;

/**
 * The authoritative shape an entry must satisfy after a patch is merged onto it.
 *
 * Identical to the create rules, and deliberately so: an edit must not be able
 * to leave an entry in a state a create would have rejected.
 */
export const MergedTimeEntrySchema = z
  .object({
    taskId: TimeEntryTaskIdSchema,
    date: TimeEntryDateSchema,
    startAt: TimeEntryStartAtSchema,
    endAt: TimeEntryEndAtSchema,
    location: TimeEntryLocationSchema,
    description: z.string().trim().nullable().optional(),
  })
  .superRefine(refineTimeEntryTimes);

export type MergedTimeEntry = z.infer<typeof MergedTimeEntrySchema>;
