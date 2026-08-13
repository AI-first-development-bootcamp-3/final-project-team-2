import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;
