import { describe, it, expect } from 'vitest';
import {
  UpdateProjectBodySchema,
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
};

describe('UpdateProjectBodySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(UpdateProjectBodySchema.parse({})).toEqual({});
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
