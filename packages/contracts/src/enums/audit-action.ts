import { z } from 'zod';

export const AuditAction = z.enum([
  'create',
  'update',
  'delete',
  'lock_month',
  'unlock_month',
]);
export type AuditAction = z.infer<typeof AuditAction>;
