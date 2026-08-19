import { describe, it, expect } from 'vitest';
import { CreateProjectBodySchema, ProjectCreateSuccessSchema } from '../index';

const validBody = { name: 'Project Alpha', clientId: '550e8400-e29b-41d4-a716-446655440000' };

const createdItem = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Project Alpha',
  clientId: validBody.clientId,
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

describe('CreateProjectBodySchema', () => {
  it('accepts a valid body', () => {
    expect(CreateProjectBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('trims name', () => {
    expect(CreateProjectBodySchema.parse({ ...validBody, name: '  Project Alpha  ' }).name).toBe(
      'Project Alpha',
    );
  });

  it('rejects missing name with VAL-22', () => {
    const result = CreateProjectBodySchema.safeParse({ clientId: validBody.clientId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-22');
    }
  });

  it('rejects empty name with VAL-22', () => {
    const result = CreateProjectBodySchema.safeParse({ ...validBody, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-22');
    }
  });

  it('rejects whitespace-only name with VAL-22', () => {
    const result = CreateProjectBodySchema.safeParse({ ...validBody, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-22');
    }
  });

  it('rejects missing clientId with VAL-23', () => {
    const result = CreateProjectBodySchema.safeParse({ name: 'Project Alpha' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-23');
    }
  });

  it('accepts optional leadManagerId, dates, and description', () => {
    const body = {
      ...validBody,
      leadManagerId: '550e8400-e29b-41d4-a716-446655440002',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      description: 'A project',
    };
    expect(CreateProjectBodySchema.parse(body)).toEqual(body);
  });

  it('rejects a non-uuid leadManagerId with VAL-29', () => {
    const result = CreateProjectBodySchema.safeParse({ ...validBody, leadManagerId: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('leadManagerId'));
      expect(issue?.message).toBe('VAL-29');
    }
  });

  it('rejects a malformed startDate with VAL-30', () => {
    const result = CreateProjectBodySchema.safeParse({ ...validBody, startDate: '01/06/2026' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('startDate'));
      expect(issue?.message).toBe('VAL-30');
    }
  });

  it('rejects endDate before startDate with VAL-31', () => {
    const result = CreateProjectBodySchema.safeParse({
      ...validBody,
      startDate: '2026-06-30',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('endDate'));
      expect(issue?.message).toBe('VAL-31');
    }
  });

  it('accepts endDate equal to startDate', () => {
    const result = CreateProjectBodySchema.safeParse({
      ...validBody,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID clientId with VAL-23', () => {
    const result = CreateProjectBodySchema.safeParse({
      name: 'Project Alpha',
      clientId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const clientIdIssue = result.error.issues.find((i) => i.path.includes('clientId'));
      expect(clientIdIssue?.message).toBe('VAL-23');
    }
  });
});

describe('ProjectCreateSuccessSchema', () => {
  it('requires isActive true and isDeleted false on create', () => {
    expect(ProjectCreateSuccessSchema.parse({ data: createdItem })).toEqual({ data: createdItem });
  });

  it('rejects a created item without isDeleted', () => {
    expect(
      ProjectCreateSuccessSchema.safeParse({
        data: {
          id: createdItem.id,
          name: createdItem.name,
          clientId: createdItem.clientId,
          clientName: createdItem.clientName,
          isActive: createdItem.isActive,
        },
      }).success,
    ).toBe(false);
  });
});
