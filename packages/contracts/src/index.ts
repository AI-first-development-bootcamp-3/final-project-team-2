import { z } from 'zod';

export * from './enums.js';

export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;

export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;

export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const AuditAction = z.enum(['create', 'update', 'delete', 'lock_month', 'unlock_month']);
export type AuditAction = z.infer<typeof AuditAction>;

export { ListMetaSchema, listSuccessSchema } from './common/list-envelope.js';
export type { ListMeta } from './common/list-envelope.js';

export { ApiErrorSchema, ApiErrorDetailSchema, zodIssuesToDetails } from './common/api-error.js';
export type { ApiError, ApiErrorDetail } from './common/api-error.js';

export {
  UsersListQuerySchema,
  UsersListSortSchema,
  UsersListOrderSchema,
  UserListItemSchema,
  UsersListSuccessSchema,
} from './users/list.js';
export type { UsersListQuery, UserListItem, UsersListSuccess } from './users/list.js';
