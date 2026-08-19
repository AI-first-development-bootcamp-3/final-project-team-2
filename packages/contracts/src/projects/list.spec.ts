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

  it('accepts sort=clientName', () => {
    expect(ProjectsListQuerySchema.parse({ sort: 'clientName' }).sort).toBe('clientName');
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
      isDeleted: false,
      reportType: 'TOTAL_HOURS' as const,
      leadManagerId: null,
      leadManagerName: null,
      startDate: null,
      endDate: null,
      description: null,
    };
    expect(ProjectListItemSchema.parse(item)).toEqual(item);
  });

  it('accepts populated lead manager, dates, and description', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App Redesign',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
      isDeleted: false,
      reportType: 'TOTAL_HOURS' as const,
      leadManagerId: '550e8400-e29b-41d4-a716-446655440002',
      leadManagerName: 'Dana Manager',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      description: 'Redesign of the mobile app',
    };
    expect(ProjectListItemSchema.parse(item)).toEqual(item);
  });

  it('requires the KAN-120 fields (missing field is a contract violation, not a default)', () => {
    const result = ProjectListItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App Redesign',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
      isDeleted: false,
      reportType: 'TOTAL_HOURS' as const,
    });
    expect(result.success).toBe(false);
  });

  it('requires reportType (missing field is a contract violation, not a default)', () => {
    const result = ProjectListItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App Redesign',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
      isDeleted: false,
    });
    expect(result.success).toBe(false);
  });

  it('requires isDeleted', () => {
    const result = ProjectListItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App Redesign',
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
    });
    expect(result.success).toBe(false);
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
          isDeleted: false,
          reportType: 'TOTAL_HOURS' as const,
          leadManagerId: null,
          leadManagerName: null,
          startDate: null,
          endDate: null,
          description: null,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(ProjectsListSuccessSchema.parse(payload)).toEqual(payload);
  });
});
