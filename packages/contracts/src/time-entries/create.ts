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
 * Body for creating a manual time entry.
 *
 * Every field is required: the manual form always reports completed work, so
 * the running-timer exemptions on VAL-35 and VAL-36 do not apply here (§8.6 is
 * the Punch Clock epic's concern).
 */
export const CreateTimeEntryBodySchema = z
  .object({
    taskId: TimeEntryTaskIdSchema,
    date: TimeEntryDateSchema,
    startAt: TimeEntryStartAtSchema,
    endAt: TimeEntryEndAtSchema,
    location: TimeEntryLocationSchema,
    // Null and omitted both mean "no description". The read shape returns
    // `null`, and the update body accepts it, so a client re-posting an entry
    // it read back — duplicate-yesterday, offline sync — must not be rejected
    // for echoing the shape we gave it.
    description: z.string().trim().nullable().optional(),
  })
  .superRefine(refineTimeEntryTimes);

export type CreateTimeEntryBody = z.infer<typeof CreateTimeEntryBodySchema>;
