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

export { CreateUserBodySchema, UserCreateSuccessSchema } from './users/create.js';
export type { CreateUserBody, UserCreateSuccess } from './users/create.js';

export { UpdateUserSchema, ResetPasswordSchema } from './users/update.js';
export type { UpdateUserPayload, ResetPasswordPayload } from './users/update.js';

export { DeactivateUserResponseSchema, RestoreUserResponseSchema } from './users/deactivate.js';
export type { DeactivateUserResponse, RestoreUserResponse } from './users/deactivate.js';

// KAN-46 / US3: login consumers (KAN-39) must query with this normalized email.
// No auth login service exists under server/api/src/modules/ yet — do not add a
// login screen here. Playwright create-then-login remains KAN-49.
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'VAL-01' })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message: 'VAL-01' }).email({ message: 'VAL-02' }))
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, { message: 'VAL-03' }).min(8, { message: 'VAL-04' }),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

export type ValCode =
  | 'VAL-01'
  | 'VAL-02'
  | 'VAL-03'
  | 'VAL-04'
  | 'VAL-10'
  | 'VAL-11'
  | 'VAL-12'
  | 'VAL-13';

export const VAL_MESSAGES: Record<ValCode, string> = {
  'VAL-01': 'כתובת האימייל היא שדה חובה',
  'VAL-02': 'כתובת האימייל שהוזנה אינה תקינה',
  'VAL-03': 'הסיסמה היא שדה חובה',
  'VAL-04': 'הסיסמה חייבת להכיל 8 תווים לפחות',
  'VAL-10': 'שם מלא הוא שדה חובה',
  'VAL-11': 'כתובת האימייל כבר בשימוש (VAL-11)',
  'VAL-12': 'יש לבחור תפקיד תקין',
  'VAL-13': 'הסיסמה הראשונית היא שדה חובה',
};
