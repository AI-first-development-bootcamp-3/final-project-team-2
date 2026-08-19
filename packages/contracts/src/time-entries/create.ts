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

/**
 * Body for creating a manual time entry.
 *
 * Every field is required: the manual form always reports completed work, so
 * the running-timer exemptions on VAL-35 and VAL-36 do not apply here (§8.6 is
 * the Punch Clock epic's concern).
 *
 * Built through `timeEntryBodySchema` so a missing or wrong-typed field cannot
 * suppress VAL-31/VAL-38 — every violation in one body is reported together.
 */
export const CreateTimeEntryBodySchema = timeEntryBodySchema({
  taskId: TimeEntryTaskIdSchema,
  date: TimeEntryDateSchema,
  startAt: TimeEntryStartAtSchema,
  endAt: TimeEntryEndAtSchema,
  location: TimeEntryLocationSchema,
  description: TimeEntryDescriptionSchema,
});

export type CreateTimeEntryBody = z.infer<typeof CreateTimeEntryBodySchema>;
