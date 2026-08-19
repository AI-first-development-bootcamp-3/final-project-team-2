import { z } from 'zod';
import { listSuccessSchema } from '../common/list-envelope.js';

export const AssignmentsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  // groupBy=task switches the response to one row per task with an employees
  // array (Admin Web Portal Spec §4.2 — KAN-122).
  groupBy: z.literal('task').optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  q: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
});

export const AssignmentListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userFullName: z.string(),
  userEmail: z.string(),
  taskId: z.string().uuid(),
  taskName: z.string(),
  projectName: z.string(),
  clientName: z.string(),
});

export const AssignmentsListSuccessSchema = listSuccessSchema(AssignmentListItemSchema);

// --- Grouped-by-task view (KAN-122, Admin Web Portal Spec §4.2) ---

export const AssignedEmployeeSchema = z.object({
  assignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  userFullName: z.string(),
  userEmail: z.string(),
});

export const AssignmentsByTaskItemSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  projectName: z.string(),
  clientName: z.string(),
  employees: z.array(AssignedEmployeeSchema),
});

export const AssignmentsByTaskListSuccessSchema = listSuccessSchema(AssignmentsByTaskItemSchema);

export type AssignmentsListQuery = z.infer<typeof AssignmentsListQuerySchema>;
export type AssignmentListItem = z.infer<typeof AssignmentListItemSchema>;
export type AssignmentsListSuccess = z.infer<typeof AssignmentsListSuccessSchema>;
export type AssignedEmployee = z.infer<typeof AssignedEmployeeSchema>;
export type AssignmentsByTaskItem = z.infer<typeof AssignmentsByTaskItemSchema>;
export type AssignmentsByTaskListSuccess = z.infer<typeof AssignmentsByTaskListSuccessSchema>;
