import { describe, it, expect } from 'vitest';
import { CreateProjectBodySchema } from '../index';

const validBody = { name: 'Project Alpha', clientId: '550e8400-e29b-41d4-a716-446655440000' };

describe('CreateProjectBodySchema', () => {
  it('accepts a valid body', () => {
    expect(CreateProjectBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('rejects missing name with VAL-22', () => {
    const result = CreateProjectBodySchema.safeParse({ clientId: validBody.clientId });
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
