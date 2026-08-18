import { z } from 'zod';
import { ReportType } from '../enums.js';
import { ProjectListItemSchema } from './list.js';

export const UpdateProjectBodySchema = z.object({
  name: z.string().trim().min(1, { message: 'VAL-22' }).optional(),
  clientId: z.string().uuid({ message: 'VAL-23' }).optional(),
  isActive: z.boolean().optional(),
  reportType: ReportType.optional(),
});

export const UpdateProjectReportTypeBodySchema = z.object({
  reportType: ReportType,
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
