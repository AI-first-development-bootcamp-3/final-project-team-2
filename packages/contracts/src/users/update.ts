import { z } from 'zod';
import { UserRole } from '../enums.js';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים').optional(),
  email: z.string().email('כתובת אימייל אינה תקינה').optional(),
  role: UserRole.optional(),
  employeeNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentType: z.string().optional(),
  employmentPercentage: z
    .number()
    .min(1, 'אחוז משרה חייב להיות לפחות 1')
    .max(100, 'אחוז משרה אינו יכול לעלות על 100')
    .optional(),
  orgUnit: z.string().optional(),
});

export type UpdateUserPayload = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל 8 תווים לפחות'),
});

export type ResetPasswordPayload = z.infer<typeof ResetPasswordSchema>;
