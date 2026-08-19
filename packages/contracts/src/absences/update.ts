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
 * Partial edit of an absence. Every field is optional, and the ones supplied
 * are held to the same rules a create must satisfy.
 *
 * The edit addresses one row but applies to its whole group: the API re-splits
 * the resulting range and replaces the group's rows, so an employee who
 * shortens a vacation that spanned a weekend gets a coherent result rather than
 * an orphaned fragment.
 */
export const UpdateAbsenceBodySchema = z
  .object({
    type: AbsenceTypeSchema.optional(),
    startDate: AbsenceStartDateSchema.optional(),
    endDate: AbsenceEndDateSchema.optional(),
    isHalfDay: z.boolean().optional(),
    halfDayPeriod: HalfDayPeriod.nullish(),
    notes: AbsenceNotesSchema,
  })
  .superRefine(refineAbsenceRange)
  .refine((body) => Object.values(body).some((field) => field !== undefined), {
    message: 'VAL-EMPTY-UPDATE',
  });

export type UpdateAbsenceBody = z.infer<typeof UpdateAbsenceBodySchema>;

/**
 * The merged absence the API validates on edit: the stored row with the patch
 * applied. Reusing the create rules here is what stops a patch that touches one
 * field from leaving the absence in a state a create would have rejected — a
 * patch moving only `endDate` onto a Saturday still fails VAL-43.
 */
export const MergedAbsenceSchema = z
  .object({
    type: AbsenceTypeSchema,
    startDate: AbsenceStartDateSchema,
    endDate: AbsenceEndDateSchema,
    isHalfDay: z.boolean(),
    halfDayPeriod: HalfDayPeriod.nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .superRefine(refineAbsenceRange);

export type MergedAbsence = z.infer<typeof MergedAbsenceSchema>;
