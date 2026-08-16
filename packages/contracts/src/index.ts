import { z } from 'zod';

export const UserRole = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const WorkLocation = z.enum(['office', 'client_site', 'home']);
export type WorkLocation = z.infer<typeof WorkLocation>;

export const VAL_MESSAGES: Record<string, string> = {
  'VAL-01': 'כתובת האימייל היא שדה חובה',
  'VAL-02': 'כתובת האימייל שהוזנה אינה תקינה',
  'VAL-03': 'הסיסמה היא שדה חובה',
  'VAL-04': 'הסיסמה חייבת להכיל 8 תווים לפחות',
};

export const LoginSchema = z.object({
  email: z.string().min(1, { message: 'VAL-01' }).email({ message: 'VAL-02' }),
  password: z.string().min(1, { message: 'VAL-03' }).min(8, { message: 'VAL-04' }),
  rememberMe: z.boolean().default(false),
});

export type LoginFormData = z.infer<typeof LoginSchema>;
