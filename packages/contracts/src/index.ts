import { z } from 'zod';
import { UserRole } from './enums.js';

// Re-exports WorkLocation, which now lives in enums.ts so time-entries/fields.ts
// can derive its VAL-36 schema from it without importing this module circularly.
export * from './enums.js';

export const AuditAction = z.enum(['create', 'update', 'delete', 'lock_month', 'unlock_month']);
export type AuditAction = z.infer<typeof AuditAction>;

export { ListMetaSchema, listSuccessSchema } from './common/list-envelope.js';
export type { ListMeta } from './common/list-envelope.js';

export type { ValCode } from './common/val-messages.js';
export { VAL_MESSAGES } from './common/val-messages.js';

export {
  ApiErrorSchema,
  ApiErrorDetailSchema,
  ROOT_DETAIL_FIELD,
  partitionDetails,
  valDetail,
  zodIssuesToDetails,
  zodIssuesToHebrewDetails,
} from './common/api-error.js';
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

// Rule codes and their Hebrew messages live in common/val-messages.js, so the
// shared error helpers can build a translated payload without importing this
// file circularly. Re-exported above.

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
  HALF_DAY_MINUTES,
  computeDayStatus,
  minutesForDay,
  isCoveredByAbsence,
  targetMinutesForDay,
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
  toLocalDateOrNull,
  isRealCalendarDate,
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

export {
  UpdateTimeEntryBodySchema,
  MergedTimeEntrySchema,
  CompletedTimeEntrySchema,
} from './time-entries/update.js';
export type {
  UpdateTimeEntryBody,
  MergedTimeEntry,
  CompletedTimeEntry,
} from './time-entries/update.js';

export {
  intervalsOverlap,
  findOverlap,
  OVERLAP_CANDIDATE_WINDOW_DAYS,
} from './time-entries/overlap.js';
export type { TimeInterval } from './time-entries/overlap.js';

export {
  MAX_TIME_ENTRY_RANGE_DAYS,
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

// --- Absences ---
export {
  AbsenceTypeSchema,
  AbsenceStartDateSchema,
  AbsenceEndDateSchema,
  AbsenceNotesSchema,
  refineAbsenceRange,
} from './absences/fields.js';
export type { AbsenceRangeFields } from './absences/fields.js';

export { splitIntoWorkingRuns, isWeekend, hasWorkingDay } from './absences/split.js';
export type { DateRange } from './absences/split.js';

export { CreateAbsenceBodySchema } from './absences/create.js';
export type { CreateAbsenceBody } from './absences/create.js';

export { UpdateAbsenceBodySchema, MergedAbsenceSchema } from './absences/update.js';
export type { UpdateAbsenceBody, MergedAbsence } from './absences/update.js';

export {
  AbsencesListQuerySchema,
  AbsenceListItemSchema,
  AbsencesListSuccessSchema,
  AbsenceCreateSuccessSchema,
  AbsenceGetSuccessSchema,
} from './absences/list.js';
export type {
  AbsencesListQuery,
  AbsenceListItem,
  AbsencesListSuccess,
  AbsenceCreateSuccess,
  AbsenceGetSuccess,
} from './absences/list.js';
