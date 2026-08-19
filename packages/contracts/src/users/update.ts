import { z } from 'zod';
import { UserRole } from '../enums.js';
import { EmploymentType } from './list.js';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים').optional(),
  email: z.string().email('כתובת אימייל אינה תקינה').optional(),
  role: UserRole.optional(),
  employeeNumber: z.string().nullable().optional(),
  roleTitle: z.string().nullable().optional(),
  employmentType: EmploymentType.nullable().optional(),
  employmentPercent: z
    .number()
    .int('אחוז משרה חייב להיות מספר שלם')
    .min(0, 'אחוז משרה חייב להיות לפחות 0')
    .max(100, 'אחוז משרה אינו יכול לעלות על 100')
    .nullable()
    .optional(),
  orgUnit: z.string().nullable().optional(),
});

export type UpdateUserPayload = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל 8 תווים לפחות'),
});

export type ResetPasswordPayload = z.infer<typeof ResetPasswordSchema>;
