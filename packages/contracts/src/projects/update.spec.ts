import { describe, it, expect } from 'vitest';
import {
  UpdateProjectBodySchema,
  UpdateProjectReportTypeBodySchema,
  ProjectUpdateSuccessSchema,
  ProjectGetSuccessSchema,
} from '../index';

const item = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Project Alpha',
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

describe('UpdateProjectReportTypeBodySchema', () => {
  it('accepts a valid reportType', () => {
    expect(UpdateProjectReportTypeBodySchema.parse({ reportType: 'CLOCK_IN_OUT' })).toEqual({
      reportType: 'CLOCK_IN_OUT',
    });
  });

  it('rejects an invalid reportType with VAL-28', () => {
    const result = UpdateProjectReportTypeBodySchema.safeParse({ reportType: 'INVALID' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-28');
    }
  });

  it('rejects a missing reportType with VAL-28', () => {
    const result = UpdateProjectReportTypeBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-28');
    }
  });
});

describe('UpdateProjectBodySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(UpdateProjectBodySchema.parse({})).toEqual({});
  });

  it('rejects an invalid reportType with VAL-28', () => {
    const result = UpdateProjectBodySchema.safeParse({ reportType: 'INVALID' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-28');
    }
  });

  it('accepts optional name, clientId, and isActive', () => {
    expect(
      UpdateProjectBodySchema.parse({
        name: 'Renamed',
        clientId: item.clientId,
        isActive: false,
      }),
    ).toEqual({
      name: 'Renamed',
      clientId: item.clientId,
      isActive: false,
    });
  });

  it('trims name', () => {
    expect(UpdateProjectBodySchema.parse({ name: '  Renamed  ' }).name).toBe('Renamed');
  });

  it('rejects whitespace-only name with VAL-22', () => {
    const result = UpdateProjectBodySchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-22');
    }
  });

  it('accepts optional leadManagerId, dates, and description', () => {
    const body = {
      leadManagerId: '550e8400-e29b-41d4-a716-446655440002',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      description: 'Updated description',
    };
    expect(UpdateProjectBodySchema.parse(body)).toEqual(body);
  });

  it('accepts null to clear leadManagerId, dates, and description', () => {
    const body = { leadManagerId: null, startDate: null, endDate: null, description: null };
    expect(UpdateProjectBodySchema.parse(body)).toEqual(body);
  });

  it('rejects a non-uuid leadManagerId with VAL-29', () => {
    const result = UpdateProjectBodySchema.safeParse({ leadManagerId: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('leadManagerId'));
      expect(issue?.message).toBe('VAL-29');
    }
  });

  it('rejects a malformed endDate with VAL-39', () => {
    const result = UpdateProjectBodySchema.safeParse({ endDate: '30/06/2026' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('endDate'));
      expect(issue?.message).toBe('VAL-39');
    }
  });

  it('rejects endDate before startDate with VAL-40', () => {
    const result = UpdateProjectBodySchema.safeParse({
      startDate: '2026-06-30',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('endDate'));
      expect(issue?.message).toBe('VAL-40');
    }
  });

  it('rejects a non-uuid clientId with VAL-23', () => {
    const result = UpdateProjectBodySchema.safeParse({ clientId: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('clientId'));
      expect(issue?.message).toBe('VAL-23');
    }
  });
});

describe('ProjectUpdateSuccessSchema', () => {
  it('wraps a ProjectListItem', () => {
    expect(ProjectUpdateSuccessSchema.parse({ data: item })).toEqual({ data: item });
  });
});

describe('ProjectGetSuccessSchema', () => {
  it('wraps a ProjectListItem', () => {
    expect(ProjectGetSuccessSchema.parse({ data: item })).toEqual({ data: item });
  });
});
