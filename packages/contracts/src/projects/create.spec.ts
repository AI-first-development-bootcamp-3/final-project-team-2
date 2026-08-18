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
