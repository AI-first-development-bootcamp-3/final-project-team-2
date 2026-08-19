import { z } from 'zod';
import { ReportType } from '../enums.js';
import { ProjectListItemSchema } from './list.js';

// VAL-28 rides the zod message so zodIssuesToDetails picks it up and the API
// maps it to Hebrew — same pattern as the role field's VAL-12.
const ReportTypeField = z.enum(ReportType.options, {
  errorMap: () => ({ message: 'VAL-28' }),
});

// KAN-120: native date inputs submit YYYY-MM-DD; anything else is VAL-39.
const IsoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'VAL-39' });

// ISO date strings compare correctly as plain strings.
function endDateNotBeforeStartDate(
  body: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'VAL-40' });
  }
}

export const UpdateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1, { message: 'VAL-22' }).optional(),
    clientId: z.string().uuid({ message: 'VAL-23' }).optional(),
    isActive: z.boolean().optional(),
    reportType: ReportTypeField.optional(),
    // KAN-120: nullable so the edit modal can clear a previously set value.
    leadManagerId: z.string().uuid({ message: 'VAL-29' }).nullable().optional(),
    startDate: IsoDateString.nullable().optional(),
    endDate: IsoDateString.nullable().optional(),
    description: z.string().trim().nullable().optional(),
  })
  .superRefine(endDateNotBeforeStartDate);

export const UpdateProjectReportTypeBodySchema = z.object({
  reportType: ReportTypeField,
});

export const ProjectGetSuccessSchema = z.object({
  data: ProjectListItemSchema,
});

export const ProjectUpdateSuccessSchema = z.object({
  data: ProjectListItemSchema,
});

export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;
export type UpdateProjectReportTypeBody = z.infer<typeof UpdateProjectReportTypeBodySchema>;
export type ProjectGetSuccess = z.infer<typeof ProjectGetSuccessSchema>;
export type ProjectUpdateSuccess = z.infer<typeof ProjectUpdateSuccessSchema>;
