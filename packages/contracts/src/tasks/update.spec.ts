import { describe, it, expect } from 'vitest';
import { UpdateTaskBodySchema } from '../index';

describe('UpdateTaskBodySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(UpdateTaskBodySchema.parse({})).toEqual({});
  });

  it('accepts name, projectId, status, and description', () => {
    const body = {
      name: 'Renamed Task',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'closed' as const,
      description: 'Updated description',
    };
    expect(UpdateTaskBodySchema.parse(body)).toEqual(body);
  });

  it('trims description', () => {
    expect(UpdateTaskBodySchema.parse({ description: '  padded  ' }).description).toBe('padded');
  });

  it('accepts null to clear description (edit modal sends null)', () => {
    expect(UpdateTaskBodySchema.parse({ description: null })).toEqual({ description: null });
  });

  it('rejects whitespace-only name with VAL-24', () => {
    const result = UpdateTaskBodySchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-24');
    }
  });

  it('rejects a non-uuid projectId with VAL-25', () => {
    const result = UpdateTaskBodySchema.safeParse({ projectId: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('projectId'));
      expect(issue?.message).toBe('VAL-25');
    }
  });
});
