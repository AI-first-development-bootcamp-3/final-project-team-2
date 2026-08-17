import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;
