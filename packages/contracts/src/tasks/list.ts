import { z } from 'zod';
import { TaskStatus } from '../enums.js';
import { listSuccessSchema } from '../common/list-envelope.js';

const includeDeletedQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean());

export const TasksListSortSchema = z.enum(['name', 'status']);
export const TasksListOrderSchema = z.enum(['asc', 'desc']);

export const TasksListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
  projectId: z.string().uuid().optional(),
  status: TaskStatus.optional(),
  includeDeleted: includeDeletedQuery,
  sort: TasksListSortSchema.default('name'),
  order: TasksListOrderSchema.default('asc'),
});

export const TaskListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  clientName: z.string(),
  status: TaskStatus,
  description: z.string().nullable(),
});

export const TasksListSuccessSchema = listSuccessSchema(TaskListItemSchema);

export type TasksListQuery = z.infer<typeof TasksListQuerySchema>;
export type TaskListItem = z.infer<typeof TaskListItemSchema>;
export type TasksListSuccess = z.infer<typeof TasksListSuccessSchema>;
