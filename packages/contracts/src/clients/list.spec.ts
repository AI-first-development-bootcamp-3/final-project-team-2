import { describe, it, expect } from 'vitest';
import { ClientsListQuerySchema, ClientListItemSchema, ClientsListSuccessSchema } from '../index';

describe('ClientsListQuerySchema', () => {
  it('applies defaults for page, limit, sort, order', () => {
    const result = ClientsListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, limit: 20, sort: 'name', order: 'asc' });
  });

  it('coerces string page and limit to numbers', () => {
    const result = ClientsListQuerySchema.parse({ page: '2', limit: '10' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('trims q and converts empty to undefined', () => {
    expect(ClientsListQuerySchema.parse({ q: '  ' }).q).toBeUndefined();
    expect(ClientsListQuerySchema.parse({ q: ' test ' }).q).toBe('test');
  });

  it('parses isActive boolean from string', () => {
    expect(ClientsListQuerySchema.parse({ isActive: 'true' }).isActive).toBe(true);
    expect(ClientsListQuerySchema.parse({ isActive: 'false' }).isActive).toBe(false);
  });

  it('parses includeDeleted boolean from string', () => {
    expect(ClientsListQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(ClientsListQuerySchema.parse({}).includeDeleted).toBe(false);
  });
});

describe('ClientListItemSchema', () => {
  it('accepts a valid client item', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Acme Corp',
      contactInfo: 'contact@acme.com',
      isActive: true,
      isDeleted: false,
    };
    expect(ClientListItemSchema.parse(item)).toEqual(item);
  });

  it('accepts null contactInfo', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Acme Corp',
      contactInfo: null,
      isActive: true,
      isDeleted: false,
    };
    expect(ClientListItemSchema.parse(item).contactInfo).toBeNull();
  });

  it('requires the isDeleted deletion indicator', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Acme Corp',
      contactInfo: null,
      isActive: true,
    };
    expect(ClientListItemSchema.safeParse(item).success).toBe(false);
    expect(ClientListItemSchema.parse({ ...item, isDeleted: true }).isDeleted).toBe(true);
  });
});

describe('ClientsListSuccessSchema', () => {
  it('accepts a valid list envelope', () => {
    const envelope = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Acme',
          contactInfo: null,
          isActive: true,
          isDeleted: false,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(ClientsListSuccessSchema.parse(envelope)).toEqual(envelope);
  });
});
