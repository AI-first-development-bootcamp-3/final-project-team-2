import { z } from 'zod';
import { UserRole } from './enums.js';

export * from './enums.js';

export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;

export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;

export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;

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
  // The refresh already loads the full user row server-side; returning the
  // summary lets clients bootstrap a session from the cookie alone.
  user: AuthUser,
});

export type RefreshResponse = z.infer<typeof RefreshResponse>;

export type ValCode =
  | 'VAL-01'
  | 'VAL-02'
  | 'VAL-03'
  | 'VAL-04'
  | 'VAL-10'
  | 'VAL-11'
  | 'VAL-12'
  | 'VAL-13'
  | 'VAL-20'
  | 'VAL-21'
  | 'VAL-22'
  | 'VAL-23'
  | 'VAL-24'
  | 'VAL-25'
  | 'VAL-26'
  | 'VAL-27'
  | 'VAL-30'
  | 'VAL-31'
  | 'VAL-32'
  | 'VAL-33'
  | 'VAL-34'
  | 'VAL-35'
  | 'VAL-36'
  | 'VAL-38'
  | 'VAL-DATE-RANGE'
  | 'VAL-EMPTY-UPDATE';

export const VAL_MESSAGES: Record<ValCode, string> = {
  'VAL-01': 'כתובת האימייל היא שדה חובה',
  'VAL-02': 'כתובת האימייל שהוזנה אינה תקינה',
  'VAL-03': 'הסיסמה היא שדה חובה',
  'VAL-04': 'הסיסמה חייבת להכיל 8 תווים לפחות',
  'VAL-10': 'שם מלא הוא שדה חובה',
  'VAL-11': 'כתובת האימייל כבר בשימוש (VAL-11)',
  'VAL-12': 'יש לבחור תפקיד תקין',
  'VAL-13': 'הסיסמה הראשונית היא שדה חובה',
  'VAL-20': 'שם הלקוח הוא שדה חובה',
  'VAL-21': 'שם הלקוח כבר קיים במערכת',
  'VAL-22': 'שם הפרויקט הוא שדה חובה',
  'VAL-23': 'יש לבחור לקוח תקין ופעיל',
  'VAL-24': 'שם המשימה הוא שדה חובה',
  'VAL-25': 'יש לבחור פרויקט תקין ופעיל',
  'VAL-26': 'יש לבחור משתמש ומשימה תקינים',
  'VAL-27': 'השיוך כבר קיים במערכת',
  // Time entries (§8.5). VAL-37 (one running timer per user) belongs to the
  // Punch Clock epic and is intentionally absent here.
  'VAL-30': 'שעת התחלה היא שדה חובה',
  'VAL-31': 'שעת הסיום חייבת להיות מאוחרת משעת ההתחלה',
  'VAL-32': 'קיים כבר דיווח שעות חופף בטווח זה',
  'VAL-33': 'אינך משויך למשימה שנבחרה',
  'VAL-34': 'החודש נעול ולא ניתן לעדכן דיווחי שעות',
  'VAL-35': 'יש לבחור משימה',
  'VAL-36': 'יש לבחור מיקום עבודה',
  'VAL-38': 'התאריך אינו תואם את יום תחילת הדיווח',
  'VAL-DATE-RANGE': 'יש לציין תאריך יחיד או טווח תאריכים תקין',
  'VAL-EMPTY-UPDATE': 'לא נשלחו שדות לעדכון',
};

// --- Clients ---
export {
  ClientsListQuerySchema,
  ClientsListSortSchema,
  ClientsListOrderSchema,
  ClientListItemSchema,
  ClientsListSuccessSchema,
} from './clients/list.js';
export type { ClientsListQuery, ClientListItem, ClientsListSuccess } from './clients/list.js';

export { CreateClientBodySchema, ClientCreateSuccessSchema } from './clients/create.js';
export type { CreateClientBody, ClientCreateSuccess } from './clients/create.js';

export { UpdateClientBodySchema } from './clients/update.js';
export type { UpdateClientBody } from './clients/update.js';

// --- Projects ---
export {
  ProjectsListQuerySchema,
  ProjectsListSortSchema,
  ProjectsListOrderSchema,
  ProjectListItemSchema,
  ProjectsListSuccessSchema,
} from './projects/list.js';
export type { ProjectsListQuery, ProjectListItem, ProjectsListSuccess } from './projects/list.js';

export { CreateProjectBodySchema, ProjectCreateSuccessSchema } from './projects/create.js';
export type { CreateProjectBody, ProjectCreateSuccess } from './projects/create.js';

export {
  UpdateProjectBodySchema,
  UpdateProjectReportTypeBodySchema,
  ProjectGetSuccessSchema,
  ProjectUpdateSuccessSchema,
} from './projects/update.js';
export type {
  UpdateProjectBody,
  UpdateProjectReportTypeBody,
  ProjectGetSuccess,
  ProjectUpdateSuccess,
} from './projects/update.js';

// --- Tasks ---
export {
  TasksListQuerySchema,
  TasksListSortSchema,
  TasksListOrderSchema,
  TaskListItemSchema,
  TasksListSuccessSchema,
} from './tasks/list.js';
export type { TasksListQuery, TaskListItem, TasksListSuccess } from './tasks/list.js';

export { CreateTaskBodySchema, TaskCreateSuccessSchema } from './tasks/create.js';
export type { CreateTaskBody, TaskCreateSuccess } from './tasks/create.js';

export { UpdateTaskBodySchema } from './tasks/update.js';
export type { UpdateTaskBody } from './tasks/update.js';

// --- Assignments ---
export {
  AssignmentsListQuerySchema,
  AssignmentListItemSchema,
  AssignmentsListSuccessSchema,
} from './assignments/list.js';
export type {
  AssignmentsListQuery,
  AssignmentListItem,
  AssignmentsListSuccess,
} from './assignments/list.js';

export { CreateAssignmentBodySchema, AssignmentCreateSuccessSchema } from './assignments/create.js';
export type { CreateAssignmentBody, AssignmentCreateSuccess } from './assignments/create.js';

// --- Me ---
export { MyAssignmentSchema, MyAssignmentsResponseSchema } from './me/assignments.js';
export type { MyAssignment, MyAssignmentsResponse } from './me/assignments.js';

// --- Day status ---
// Computed, never stored (§2.4). Exported from here so the daily quota bar and
// the monthly calendar share one implementation of the thresholds.
export {
  DayStatus,
  FULL_DAY_MINUTES,
  computeDayStatus,
  minutesForDay,
  isCoveredByAbsence,
} from './day-status/day-status.js';
export type {
  DayStatusEntry,
  DayStatusAbsence,
  DayStatusInput,
  DayStatusResult,
} from './day-status/day-status.js';

export {
  APP_TIME_ZONE,
  LOCAL_DATE_PATTERN,
  toLocalDate,
  isSameLocalDate,
  toYearMonth,
} from './day-status/local-date.js';

// --- Time entries ---
export {
  TimeEntryLocationSchema,
  TimeEntryDateSchema,
  TimeEntryTaskIdSchema,
  TimeEntryStartAtSchema,
  TimeEntryEndAtSchema,
  refineTimeEntryTimes,
} from './time-entries/fields.js';
export type { TimeEntryTimes } from './time-entries/fields.js';

export { CreateTimeEntryBodySchema } from './time-entries/create.js';
export type { CreateTimeEntryBody } from './time-entries/create.js';

export { UpdateTimeEntryBodySchema, MergedTimeEntrySchema } from './time-entries/update.js';
export type { UpdateTimeEntryBody, MergedTimeEntry } from './time-entries/update.js';

export {
  TimeEntriesListQuerySchema,
  TimeEntryListItemSchema,
  TimeEntriesListSuccessSchema,
  TimeEntrySuccessSchema,
} from './time-entries/list.js';
export type {
  TimeEntriesListQuery,
  TimeEntryListItem,
  TimeEntriesListSuccess,
  TimeEntrySuccess,
} from './time-entries/list.js';
