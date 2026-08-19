import { z } from 'zod';
import type { WorkLocation } from '../enums.js';
import {
  TimeEntryDateSchema,
  TimeEntryEndAtSchema,
  TimeEntryLocationSchema,
  TimeEntryStartAtSchema,
  TimeEntryTaskIdSchema,
  isRunning,
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
      // Reported at the root: no single field is at fault. `zodIssuesToDetails`
      // renders that as field `(root)`, which no input matches — consumers must
      // surface it as a form-level message, or the employee gets a save that
      // silently does nothing. `partitionDetails` exists for exactly that.
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
 * Identical to the create rules for a completed entry, and deliberately so: an
 * edit must not be able to leave an entry in a state a create would have
 * rejected.
 *
 * A *running* entry (§8.6, design D7) has no end time, and none of VAL-31,
 * VAL-35, or VAL-36 apply to it — so `endAt`, `taskId`, and `location` are
 * nullable here and required only once an end time is present. Without that,
 * this seam could not re-validate the very rows the Punch Clock epic writes,
 * and that epic would have to bypass or rewrite it.
 */
export const MergedTimeEntrySchema = z
  .object({
    taskId: TimeEntryTaskIdSchema.nullable(),
    date: TimeEntryDateSchema,
    startAt: TimeEntryStartAtSchema,
    endAt: TimeEntryEndAtSchema.nullable().optional(),
    location: TimeEntryLocationSchema.nullable(),
    description: z.string().trim().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    refineTimeEntryTimes(value, ctx);

    if (isRunning(value.endAt)) {
      return;
    }

    // Completed work must name what it was against and where it was done.
    if (value.taskId === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['taskId'], message: 'VAL-35' });
    }

    if (value.location === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['location'], message: 'VAL-36' });
    }
  });

export type MergedTimeEntry = z.infer<typeof MergedTimeEntrySchema>;

/** A merged entry that has been completed — every field a write needs. */
export interface CompletedTimeEntry {
  taskId: string;
  date: string;
  startAt: string;
  endAt: string;
  location: WorkLocation;
  description?: string | null | undefined;
}

/**
 * `MergedTimeEntrySchema` narrowed to a completed entry.
 *
 * This epic never edits a running entry — the API refuses that outright with
 * VAL-RUNNING-ENTRY (§8.6) — so its write path needs the non-null guarantees.
 * Requiring the end time here is what makes the other two safe to assert: the
 * merged rules above already require a task and a location whenever one is
 * present.
 */
export const CompletedTimeEntrySchema = MergedTimeEntrySchema.superRefine((value, ctx) => {
  if (isRunning(value.endAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'VAL-31' });
  }
}).transform((value) => value as CompletedTimeEntry);
