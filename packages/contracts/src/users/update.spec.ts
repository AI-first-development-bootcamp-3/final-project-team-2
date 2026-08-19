import { describe, it, expect } from 'vitest';
import { UpdateUserSchema, ResetPasswordSchema } from './update';

describe('UpdateUserSchema & ResetPasswordSchema', () => {
  it('validates partial update payloads with HR metadata fields', () => {
    const valid = UpdateUserSchema.safeParse({
      fullName: 'ישראל ישראלי',
      email: 'israel@example.com',
      role: 'admin',
      employeeNumber: 'EMP-101',
      roleTitle: 'מפתח תוכנה',
      employmentType: 'worker',
      employmentPercent: 100,
      orgUnit: 'פיתוח',
    });
    expect(valid.success).toBe(true);
  });

  it('accepts null HR fields so an admin can clear them', () => {
    const valid = UpdateUserSchema.safeParse({
      employeeNumber: null,
      roleTitle: null,
      employmentType: null,
      employmentPercent: null,
      orgUnit: null,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects an unknown employmentType', () => {
    expect(UpdateUserSchema.safeParse({ employmentType: 'freelancer' }).success).toBe(false);
  });

  it('accepts employmentPercent between 0 and 100 and rejects out-of-range or fractions', () => {
    expect(UpdateUserSchema.safeParse({ employmentPercent: 0 }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ employmentPercent: 100 }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ employmentPercent: -1 }).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ employmentPercent: 101 }).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ employmentPercent: 50.5 }).success).toBe(false);
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
