import { z } from 'zod';
import { HalfDayPeriod } from '../enums.js';
import {
  AbsenceEndDateSchema,
  AbsenceNotesSchema,
  AbsenceStartDateSchema,
  AbsenceTypeSchema,
  refineAbsenceRange,
} from './fields.js';

/**
 * Body for reporting an absence.
 *
 * One body can produce several stored rows: a range spanning a weekend is split
 * into one row per contiguous run of working days (VAL-43), all sharing a group
 * id. The employee reports a range; the store holds working days.
 *
 * A single day is reported as `endDate` equal to `startDate` rather than by
 * omitting it, so there is exactly one shape on the wire.
 */
export const CreateAbsenceBodySchema = z
  .object({
    type: AbsenceTypeSchema,
    startDate: AbsenceStartDateSchema,
    endDate: AbsenceEndDateSchema,
    isHalfDay: z.boolean().optional().default(false),
    halfDayPeriod: HalfDayPeriod.nullish(),
    notes: AbsenceNotesSchema,
  })
  .superRefine(refineAbsenceRange);

export type CreateAbsenceBody = z.infer<typeof CreateAbsenceBodySchema>;
