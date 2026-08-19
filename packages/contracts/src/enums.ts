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

/** The four fixed absence types (§2.3, VAL-40). */
export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;

/** Which half of the day a half-day absence covers. */
export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;

/**
 * Types the law expects a document for (VAL-44). Creating one of these is also
 * the single employee-side exception to the month lock (VAL-45, §7.3).
 */
export const DOCUMENT_REQUIRED_ABSENCE_TYPES = [
  'sick',
  'military',
] as const satisfies readonly AbsenceType[];

export function requiresDocument(type: AbsenceType): boolean {
  return (DOCUMENT_REQUIRED_ABSENCE_TYPES as readonly AbsenceType[]).includes(type);
}
