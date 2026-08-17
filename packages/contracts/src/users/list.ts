import { z } from 'zod';
import { UserRole } from '../enums';
import { listSuccessSchema } from '../common/list-envelope';

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

export const UsersListSortSchema = z.enum(['fullName', 'email', 'role', 'isActive']);
export const UsersListOrderSchema = z.enum(['asc', 'desc']);

export const UsersListQuerySchema = z.object({
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
  role: UserRole.optional(),
  isActive: queryBoolean,
  includeDeleted: includeDeletedQuery,
  sort: UsersListSortSchema.default('fullName'),
  order: UsersListOrderSchema.default('asc'),
});

export const UserListItemSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  role: UserRole,
  isActive: z.boolean(),
});

export const UsersListSuccessSchema = listSuccessSchema(UserListItemSchema);

export type UsersListQuery = z.infer<typeof UsersListQuerySchema>;
export type UserListItem = z.infer<typeof UserListItemSchema>;
export type UsersListSuccess = z.infer<typeof UsersListSuccessSchema>;
