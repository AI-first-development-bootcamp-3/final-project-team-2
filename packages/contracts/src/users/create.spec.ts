import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CreateUserBodySchema,
  UserCreateSuccessSchema,
  zodIssuesToDetails,
} from '../index';

const validBody = {
  fullName: 'Nadav Cohen',
  email: 'nadav@org.com',
  password: 'secret123',
  role: 'employee' as const,
};

const sampleItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'Nadav Cohen',
  email: 'nadav@org.com',
  role: 'employee' as const,
  isActive: true,
};

describe('CreateUserBodySchema', () => {
  it('accepts a valid create body', () => {
    expect(CreateUserBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('trims and lowercases email', () => {
    expect(
      CreateUserBodySchema.parse({
        ...validBody,
        email: '  Nadav@Org.com  ',
      }).email,
    ).toBe('nadav@org.com');
  });

  it('does not trim password', () => {
    expect(
      CreateUserBodySchema.parse({
        ...validBody,
        password: ' secret12',
      }).password,
    ).toBe(' secret12');
  });

  it('rejects a whitespace-only name with VAL-10', () => {
    const result = CreateUserBodySchema.safeParse({ ...validBody, fullName: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('VAL-10');
  });

  it('rejects blank and malformed email with VAL-02', () => {
    expect(CreateUserBodySchema.safeParse({ ...validBody, email: '   ' }).success).toBe(false);
    const blank = CreateUserBodySchema.safeParse({ ...validBody, email: '' });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(blank.error.issues[0]?.message).toBe('VAL-02');
    }
    const malformed = CreateUserBodySchema.safeParse({ ...validBody, email: 'not-an-email' });
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.issues[0]?.message).toBe('VAL-02');
    }
  });

  it('rejects an empty password with VAL-13', () => {
    const result = CreateUserBodySchema.safeParse({ ...validBody, password: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('VAL-13');
  });

  it('rejects a 7-character password with VAL-04', () => {
    const result = CreateUserBodySchema.safeParse({ ...validBody, password: '1234567' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('VAL-04');
  });

  it('rejects an invalid role with VAL-12', () => {
    const result = CreateUserBodySchema.safeParse({ ...validBody, role: 'manager' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('VAL-12');
  });
});

describe('UserCreateSuccessSchema', () => {
  it('accepts a created person envelope', () => {
    const envelope = { data: sampleItem };
    expect(UserCreateSuccessSchema.parse(envelope)).toEqual(envelope);
  });

  it('rejects password and hash fields from the public created-person shape', () => {
    const parsed = UserCreateSuccessSchema.parse({
      data: {
        ...sampleItem,
        password: 'secret123',
        passwordHash: 'hash',
        password_hash: 'hash',
        tokenVersion: 3,
        token_version: 3,
      },
    });
    expect(parsed.data).toEqual(sampleItem);
    expect(parsed.data).not.toHaveProperty('password');
    expect(parsed.data).not.toHaveProperty('passwordHash');
    expect(parsed.data).not.toHaveProperty('password_hash');
    expect(parsed.data).not.toHaveProperty('tokenVersion');
    expect(parsed.data).not.toHaveProperty('token_version');
  });
});

describe('zodIssuesToDetails create fields', () => {
  it('uses a VAL-* Zod issue message as details[].rule instead of VAL-QUERY', () => {
    const details = zodIssuesToDetails([
      { code: 'custom', path: ['fullName'], message: 'VAL-10' } as z.ZodIssue,
      { code: 'custom', path: ['password'], message: 'VAL-13' } as z.ZodIssue,
      { code: 'custom', path: ['role'], message: 'VAL-12' } as z.ZodIssue,
    ]);
    expect(details).toEqual([
      { field: 'fullName', rule: 'VAL-10', message: 'VAL-10' },
      { field: 'password', rule: 'VAL-13', message: 'VAL-13' },
      { field: 'role', rule: 'VAL-12', message: 'VAL-12' },
    ]);
  });
});
