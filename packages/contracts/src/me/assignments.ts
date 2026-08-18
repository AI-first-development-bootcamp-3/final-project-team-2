import { z } from 'zod';
import { ReportType } from '../enums.js';

export const MyAssignmentSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  reportType: ReportType.default('TOTAL_HOURS'),
});

export const MyAssignmentsResponseSchema = z.object({
  data: z.array(MyAssignmentSchema),
});

export type MyAssignment = z.infer<typeof MyAssignmentSchema>;
export type MyAssignmentsResponse = z.infer<typeof MyAssignmentsResponseSchema>;
