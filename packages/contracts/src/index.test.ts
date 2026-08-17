import { describe, it, expect } from 'vitest';
import { UserRole, WorkLocation, LoginSchema } from './index';

describe('Contracts Smoke Test', () => {
  it('should validate roles correctly', () => {
    expect(UserRole.safeParse('admin').success).toBe(true);
    expect(UserRole.safeParse('employee').success).toBe(true);
    expect(UserRole.safeParse('invalid').success).toBe(false);
  });

  it('should validate work locations correctly', () => {
    expect(WorkLocation.safeParse('home').success).toBe(true);
    expect(WorkLocation.safeParse('invalid').success).toBe(false);
  });

  it('should validate login credentials schema correctly with VAL error messages', () => {
    // Valid login payload
    const valid = LoginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: true,
    });
    expect(valid.success).toBe(true);

    // Empty email -> VAL-01
    const emptyEmail = LoginSchema.safeParse({ email: '', password: 'password123' });
    expect(emptyEmail.success).toBe(false);
    if (!emptyEmail.success) {
      expect(emptyEmail.error?.issues[0]?.message).toBe('VAL-01');
    }

    // Invalid email format -> VAL-02
    const invalidEmail = LoginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(invalidEmail.success).toBe(false);
    if (!invalidEmail.success) {
      expect(invalidEmail.error?.issues[0]?.message).toBe('VAL-02');
    }

    // Empty password -> VAL-03
    const emptyPassword = LoginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(emptyPassword.success).toBe(false);
    if (!emptyPassword.success) {
      expect(emptyPassword.error?.issues[0]?.message).toBe('VAL-03');
    }

    // Short password -> VAL-04
    const shortPassword = LoginSchema.safeParse({ email: 'user@example.com', password: 'short' });
    expect(shortPassword.success).toBe(false);
    if (!shortPassword.success) {
      expect(shortPassword.error?.issues[0]?.message).toBe('VAL-04');
    }
  });
});
