import { z } from 'zod';
import { UserRole } from './enums.js';

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

export const LoginSchema = z.object({
  email: z.string().min(1, { message: 'VAL-01' }).email({ message: 'VAL-02' }),
  password: z.string().min(1, { message: 'VAL-03' }).min(8, { message: 'VAL-04' }),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

export const AuthUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  role: UserRole,
});

export type AuthUser = z.infer<typeof AuthUser>;

export const LoginResponse = z.object({
  accessToken: z.string().min(1),
  user: AuthUser,
});

export type LoginResponse = z.infer<typeof LoginResponse>;

export const RefreshResponse = z.object({
  accessToken: z.string().min(1),
});

export type RefreshResponse = z.infer<typeof RefreshResponse>;

export type ValCode = 'VAL-01' | 'VAL-02' | 'VAL-03' | 'VAL-04';

export const VAL_MESSAGES: Record<ValCode, string> = {
  'VAL-01': 'כתובת האימייל היא שדה חובה',
  'VAL-02': 'כתובת האימייל שהוזנה אינה תקינה',
  'VAL-03': 'הסיסמה היא שדה חובה',
  'VAL-04': 'הסיסמה חייבת להכיל 8 תווים לפחות',
};
