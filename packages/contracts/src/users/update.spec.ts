import { describe, it, expect } from 'vitest';
import { UpdateUserSchema, ResetPasswordSchema } from './update';

describe('UpdateUserSchema & ResetPasswordSchema', () => {
  it('validates partial update payloads with HR metadata fields', () => {
    const valid = UpdateUserSchema.safeParse({
      fullName: 'ישראל ישראלי',
      email: 'israel@example.com',
      role: 'admin',
      employeeNumber: 'EMP-101',
      jobTitle: 'מפתח תוכנה',
      employmentPercentage: 100,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid email formats in UpdateUserSchema', () => {
    const res = UpdateUserSchema.safeParse({ email: 'invalid-email' });
    expect(res.success).toBe(false);
  });

  it('validates ResetPasswordSchema requiring at least 8 characters', () => {
    expect(ResetPasswordSchema.safeParse({ password: '12345678' }).success).toBe(true);
    expect(ResetPasswordSchema.safeParse({ password: 'short' }).success).toBe(false);
  });
});
