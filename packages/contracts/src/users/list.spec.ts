import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  UsersListQuerySchema,
  UserListItemSchema,
  UsersListSuccessSchema,
  ApiErrorSchema,
  zodIssuesToDetails,
} from '../index';

const sampleItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'Alice Cohen',
  email: 'employee1@abra.co',
  role: 'employee' as const,
  isActive: true,
};

describe('UsersListQuerySchema', () => {
  it('applies defaults for an empty query', () => {
    expect(UsersListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      q: undefined,
      includeDeleted: false,
      sort: 'fullName',
      order: 'asc',
    });
  });

  it('coerces page and limit from query strings', () => {
    expect(UsersListQuerySchema.parse({ page: '2', limit: '20' })).toMatchObject({
      page: 2,
      limit: 20,
    });
  });

  it('rejects limit above 100', () => {
    const result = UsersListQuerySchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects limit below 1', () => {
    expect(UsersListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejects page below 1', () => {
    expect(UsersListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('trims whitespace-only q to no search', () => {
    expect(UsersListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('trims a real search string', () => {
    expect(UsersListQuerySchema.parse({ q: '  alice  ' }).q).toBe('alice');
  });

  it('parses role, isActive, includeDeleted, sort, and order', () => {
    expect(
      UsersListQuerySchema.parse({
        role: 'admin',
        isActive: 'false',
        includeDeleted: 'true',
        sort: 'email',
        order: 'desc',
      }),
    ).toMatchObject({
      role: 'admin',
      isActive: false,
      includeDeleted: true,
      sort: 'email',
      order: 'desc',
    });
  });

  it('rejects unknown sort', () => {
    expect(UsersListQuerySchema.safeParse({ sort: 'password' }).success).toBe(false);
  });

  it('accepts native booleans for isActive and includeDeleted', () => {
    expect(UsersListQuerySchema.parse({ isActive: true, includeDeleted: false })).toMatchObject({
      isActive: true,
      includeDeleted: false,
    });
  });

  it('treats empty isActive as omitted and empty includeDeleted as false', () => {
    expect(UsersListQuerySchema.parse({ isActive: '', includeDeleted: '' })).toMatchObject({
      isActive: undefined,
      includeDeleted: false,
    });
  });

  it('rejects invalid boolean query strings', () => {
    expect(UsersListQuerySchema.safeParse({ isActive: 'yes' }).success).toBe(false);
    expect(UsersListQuerySchema.safeParse({ includeDeleted: 'yes' }).success).toBe(false);
  });
});

describe('UserListItemSchema', () => {
  it('accepts a directory row', () => {
    expect(UserListItemSchema.parse(sampleItem)).toEqual(sampleItem);
  });

  it('rejects secrets-shaped extra required fields by omitting them from the parsed object', () => {
    const parsed = UserListItemSchema.parse({
      ...sampleItem,
      password_hash: 'secret',
      token_version: 3,
    });
    expect(parsed).toEqual(sampleItem);
    expect(parsed).not.toHaveProperty('password_hash');
    expect(parsed).not.toHaveProperty('token_version');
  });

  it('rejects an invalid role', () => {
    expect(UserListItemSchema.safeParse({ ...sampleItem, role: 'manager' }).success).toBe(false);
  });

  it('accepts a directory row with HR metadata fields', () => {
    const withHr = {
      ...sampleItem,
      employeeNumber: 'EMP-101',
      roleTitle: 'מפתחת תוכנה',
      employmentType: 'worker' as const,
      employmentPercent: 80,
      orgUnit: 'פיתוח',
    };
    expect(UserListItemSchema.parse(withHr)).toEqual(withHr);
  });

  it('accepts null HR metadata fields', () => {
    const withNulls = {
      ...sampleItem,
      employeeNumber: null,
      roleTitle: null,
      employmentType: null,
      employmentPercent: null,
      orgUnit: null,
    };
    expect(UserListItemSchema.parse(withNulls)).toEqual(withNulls);
  });

  it('rejects an invalid employmentType or out-of-range employmentPercent', () => {
    expect(
      UserListItemSchema.safeParse({ ...sampleItem, employmentType: 'freelancer' }).success,
    ).toBe(false);
    expect(UserListItemSchema.safeParse({ ...sampleItem, employmentPercent: 101 }).success).toBe(
      false,
    );
  });
});

describe('UsersListSuccessSchema', () => {
  it('accepts a list envelope including an empty past-last page', () => {
    const envelope = {
      data: [],
      meta: { page: 99, limit: 20, total: 3 },
    };
    expect(UsersListSuccessSchema.parse(envelope)).toEqual(envelope);
  });

  it('accepts a populated page', () => {
    const envelope = {
      data: [sampleItem],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(UsersListSuccessSchema.parse(envelope)).toEqual(envelope);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts a validation error envelope', () => {
    const error = {
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field: 'limit', rule: 'VAL-LIMIT', message: 'Too large' }],
    };
    expect(ApiErrorSchema.parse(error)).toEqual(error);
  });
});

describe('zodIssuesToDetails', () => {
  it('maps known query fields to VAL-* rules', () => {
    const result = UsersListQuerySchema.safeParse({ limit: '101', sort: 'nope' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const details = zodIssuesToDetails(result.error.issues);
    expect(details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'limit', rule: 'VAL-LIMIT' }),
        expect.objectContaining({ field: 'sort', rule: 'VAL-SORT' }),
      ]),
    );
  });

  it('uses VAL-QUERY for unknown fields and (root) when the path is empty', () => {
    const details = zodIssuesToDetails([
      { code: 'custom', path: ['unknownField'], message: 'bad' } as z.ZodIssue,
      { code: 'custom', path: [], message: 'root' } as z.ZodIssue,
    ]);
    expect(details).toEqual([
      { field: 'unknownField', rule: 'VAL-QUERY', message: 'bad' },
      { field: '(root)', rule: 'VAL-QUERY', message: 'root' },
    ]);
  });
});
