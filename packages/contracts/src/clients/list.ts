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

export const ClientsListSortSchema = z.enum(['name', 'isActive']);
export const ClientsListOrderSchema = z.enum(['asc', 'desc']);

export const ClientsListQuerySchema = z.object({
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
  isActive: queryBoolean,
  includeDeleted: includeDeletedQuery,
  sort: ClientsListSortSchema.default('name'),
  order: ClientsListOrderSchema.default('asc'),
});

export const ClientListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactInfo: z.string().nullable(),
  isActive: z.boolean(),
});

export const ClientsListSuccessSchema = listSuccessSchema(ClientListItemSchema);

export type ClientsListQuery = z.infer<typeof ClientsListQuerySchema>;
export type ClientListItem = z.infer<typeof ClientListItemSchema>;
export type ClientsListSuccess = z.infer<typeof ClientsListSuccessSchema>;
