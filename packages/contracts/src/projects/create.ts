import { z } from 'zod';
import { ProjectListItemSchema } from './list.js';

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

export const CreateProjectBodySchema = z
  .object({
    name: z
      .string({ required_error: 'VAL-22', invalid_type_error: 'VAL-22' })
      .trim()
      .min(1, { message: 'VAL-22' }),
    clientId: z
      .string({ required_error: 'VAL-23', invalid_type_error: 'VAL-23' })
      .uuid({ message: 'VAL-23' }),
    leadManagerId: z.string().uuid({ message: 'VAL-29' }).optional(),
    startDate: IsoDateString.optional(),
    endDate: IsoDateString.optional(),
    description: z.string().trim().optional(),
  })
  .superRefine(endDateNotBeforeStartDate);

export const ProjectCreateSuccessSchema = z.object({
  data: ProjectListItemSchema,
});

export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;
export type ProjectCreateSuccess = z.infer<typeof ProjectCreateSuccessSchema>;
