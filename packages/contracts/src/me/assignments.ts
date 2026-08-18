import { z } from 'zod';
import { ReportType } from '../enums.js';

export const MyAssignmentSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  // Required on purpose: the DB column is NOT NULL with a default, so a
  // missing field is a contract violation — defaulting here would mask it.
  reportType: ReportType,
});

export const MyAssignmentsResponseSchema = z.object({
  data: z.array(MyAssignmentSchema),
});

export type MyAssignment = z.infer<typeof MyAssignmentSchema>;
export type MyAssignmentsResponse = z.infer<typeof MyAssignmentsResponseSchema>;
