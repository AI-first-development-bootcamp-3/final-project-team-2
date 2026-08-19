import { z } from 'zod';
import { EmploymentType, UserListItemSchema } from './list.js';

export const CreateUserBodySchema = z.object({
  fullName: z
    .string({ required_error: 'VAL-10', invalid_type_error: 'VAL-10' })
    .trim()
    .min(1, { message: 'VAL-10' }),
  email: z
    .string({ required_error: 'VAL-02', invalid_type_error: 'VAL-02' })
    .trim()
    .email({ message: 'VAL-02' })
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: 'VAL-13', invalid_type_error: 'VAL-13' })
    .min(1, { message: 'VAL-13' })
    .pipe(z.string().min(8, { message: 'VAL-04' })),
  role: z.enum(['employee', 'admin'], {
    errorMap: () => ({ message: 'VAL-12' }),
  }),
  employeeNumber: z.string().trim().optional(),
  roleTitle: z.string().trim().optional(),
  employmentType: EmploymentType.optional(),
  employmentPercent: z.number().int().min(0).max(100).optional(),
  orgUnit: z.string().trim().optional(),
});

export const UserCreateSuccessSchema = z.object({
  data: UserListItemSchema,
});

export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;
export type UserCreateSuccess = z.infer<typeof UserCreateSuccessSchema>;
