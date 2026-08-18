import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const ReportType = z.enum(['TOTAL_HOURS', 'CLOCK_IN_OUT']);
export type ReportType = z.infer<typeof ReportType>;
