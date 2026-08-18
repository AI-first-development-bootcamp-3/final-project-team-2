import { describe, it, expect } from 'vitest';
import {
  ProjectsListQuerySchema,
  ProjectListItemSchema,
  ProjectsListSuccessSchema,
} from '../index';

describe('ProjectsListQuerySchema', () => {
  it('applies default pagination, sorting and order', () => {
    const result = ProjectsListQuerySchema.parse({});
    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      sort: 'name',
      order: 'asc',
      includeDeleted: false,
    });
  });

  it('coerces string page and limit to numbers', () => {
    const result = ProjectsListQuerySchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('trims q search parameter', () => {
    expect(ProjectsListQuerySchema.parse({ q: '  project  ' }).q).toBe('project');
    expect(ProjectsListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('parses clientId UUID', () => {
    const clientId = '550e8400-e29b-41d4-a716-446655440000';
    expect(ProjectsListQuerySchema.parse({ clientId }).clientId).toBe(clientId);
  });

  it('parses boolean query values', () => {
    expect(ProjectsListQuerySchema.parse({ isActive: 'true' }).isActive).toBe(true);
    expect(ProjectsListQuerySchema.parse({ isActive: 'false' }).isActive).toBe(false);
    expect(ProjectsListQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(ProjectsListQuerySchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(false);
  });
});

describe('ProjectListItemSchema', () => {
  it('accepts valid project list item', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App Redesign',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
    };
    expect(ProjectListItemSchema.parse(item)).toEqual(item);
  });
});

describe('ProjectsListSuccessSchema', () => {
  it('validates envelope payload', () => {
    const payload = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Mobile App Redesign',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          clientName: 'Acme Corp',
          isActive: true,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(ProjectsListSuccessSchema.parse(payload)).toEqual(payload);
  });
});
