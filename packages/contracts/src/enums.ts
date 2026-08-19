import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const ReportType = z.enum(['TOTAL_HOURS', 'CLOCK_IN_OUT']);
export type ReportType = z.infer<typeof ReportType>;

/**
 * Work location for a time entry (VAL-36).
 *
 * Lives here rather than in index.ts so schemas can derive from it: index.ts
 * imports from every capability folder, so importing it back would be circular.
 * `TimeEntryLocationSchema` builds on `WorkLocation.options`, keeping one
 * source of truth for the wire enum.
 */
export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;

export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;

export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;

export const AuditAction = z.enum(['create', 'update', 'delete', 'lock_month', 'unlock_month']);
export type AuditAction = z.infer<typeof AuditAction>;
