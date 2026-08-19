import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const ReportType = z.enum(['TOTAL_HOURS', 'CLOCK_IN_OUT']);
export type ReportType = z.infer<typeof ReportType>;

/**
 * Where the work was done.
 *
 * Lives here rather than in index.ts so the time-entry contracts can derive
 * their VAL-36 schema from it — importing index.ts would be circular, and
 * re-declaring the literals left two compile-time-unlinked sources of truth for
 * one wire enum. index.ts re-exports this file, so the public name is unchanged.
 */
export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;
