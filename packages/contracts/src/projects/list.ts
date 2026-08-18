import { z } from 'zod';
import { listSuccessSchema } from '../common/list-envelope.js';

const queryBoolean = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean().optional());

const includeDeletedQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean());

export const ProjectsListSortSchema = z.enum(['name', 'isActive']);
export const ProjectsListOrderSchema = z.enum(['asc', 'desc']);

export const ProjectsListQuerySchema = z.object({
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
  clientId: z.string().uuid().optional(),
  isActive: queryBoolean,
  includeDeleted: includeDeletedQuery,
  sort: ProjectsListSortSchema.default('name'),
  order: ProjectsListOrderSchema.default('asc'),
});

export const ProjectListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  isActive: z.boolean(),
});

export const ProjectsListSuccessSchema = listSuccessSchema(ProjectListItemSchema);

export type ProjectsListQuery = z.infer<typeof ProjectsListQuerySchema>;
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;
export type ProjectsListSuccess = z.infer<typeof ProjectsListSuccessSchema>;
