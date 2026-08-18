import { z } from 'zod';

export const MyAssignmentSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  clientId: z.string().uuid(),
  clientName: z.string(),
});

export const MyAssignmentsResponseSchema = z.object({
  data: z.array(MyAssignmentSchema),
});

export type MyAssignment = z.infer<typeof MyAssignmentSchema>;
export type MyAssignmentsResponse = z.infer<typeof MyAssignmentsResponseSchema>;
