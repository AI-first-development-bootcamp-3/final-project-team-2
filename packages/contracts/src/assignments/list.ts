import { z } from 'zod';
import { listSuccessSchema } from '../common/list-envelope.js';

export const AssignmentsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
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

export type AssignmentsListQuery = z.infer<typeof AssignmentsListQuerySchema>;
export type AssignmentListItem = z.infer<typeof AssignmentListItemSchema>;
export type AssignmentsListSuccess = z.infer<typeof AssignmentsListSuccessSchema>;
