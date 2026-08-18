import { describe, it, expect } from 'vitest';
import { UserRole, WorkLocation, LoginSchema, LoginResponse, RefreshResponse } from './index';

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

    // Mixed-case email is trimmed and lowercased so it matches stored create emails
    const mixedCase = LoginSchema.safeParse({
      email: '  Nadav@Org.com  ',
      password: 'password123',
    });
    expect(mixedCase.success).toBe(true);
    if (mixedCase.success) {
      expect(mixedCase.data.email).toBe('nadav@org.com');
    }

    // Whitespace-only email -> VAL-01 after trim
    const whitespaceEmail = LoginSchema.safeParse({ email: '   ', password: 'password123' });
    expect(whitespaceEmail.success).toBe(false);
    if (!whitespaceEmail.success) {
      expect(whitespaceEmail.error?.issues[0]?.message).toBe('VAL-01');
    }
  });

  it('should default rememberMe to false when omitted', () => {
    const parsed = LoginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rememberMe).toBe(false);
    }
  });
});

describe('Auth response contracts', () => {
  it('should validate a login response with access token and user summary', () => {
    const valid = LoginResponse.safeParse({
      accessToken: 'header.payload.signature',
      user: {
        id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
        email: 'user@example.com',
        fullName: 'ישראל ישראלי',
        role: 'employee',
      },
    });
    expect(valid.success).toBe(true);
  });

  it('should reject a login response missing the access token or with a bad user', () => {
    expect(
      LoginResponse.safeParse({
        accessToken: '',
        user: {
          id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
          email: 'user@example.com',
          fullName: 'ישראל ישראלי',
          role: 'employee',
        },
      }).success,
    ).toBe(false);

    expect(
      LoginResponse.safeParse({
        accessToken: 'header.payload.signature',
        user: { id: 'not-a-uuid', email: 'user@example.com', fullName: 'x', role: 'boss' },
      }).success,
    ).toBe(false);
  });

  it('should validate a refresh response carrying the token and user summary', () => {
    const user = {
      id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
      email: 'user@example.com',
      fullName: 'ישראל ישראלי',
      role: 'employee',
    };
    expect(
      RefreshResponse.safeParse({ accessToken: 'header.payload.signature', user }).success,
    ).toBe(true);
    // Clients bootstrap sessions from this response, so the user summary is
    // required — a token alone is not a valid refresh payload.
    expect(RefreshResponse.safeParse({ accessToken: 'header.payload.signature' }).success).toBe(
      false,
    );
    expect(RefreshResponse.safeParse({ accessToken: '', user }).success).toBe(false);
    expect(RefreshResponse.safeParse({}).success).toBe(false);
  });
});
