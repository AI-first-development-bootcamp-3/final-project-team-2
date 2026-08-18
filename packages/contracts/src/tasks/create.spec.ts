import { describe, it, expect } from 'vitest';
import { CreateTaskBodySchema } from '../index';

const validBody = { name: 'Task One', projectId: '550e8400-e29b-41d4-a716-446655440000' };

describe('CreateTaskBodySchema', () => {
  it('accepts a valid body', () => {
    expect(CreateTaskBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('accepts optional description', () => {
    const body = { ...validBody, description: 'Do this thing' };
    expect(CreateTaskBodySchema.parse(body).description).toBe('Do this thing');
  });

  it('rejects missing name with VAL-24', () => {
    const result = CreateTaskBodySchema.safeParse({ projectId: validBody.projectId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-24');
    }
  });

  it('rejects missing projectId with VAL-25', () => {
    const result = CreateTaskBodySchema.safeParse({ name: 'Task One' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-25');
    }
  });

  it('rejects invalid UUID projectId with VAL-25', () => {
    const result = CreateTaskBodySchema.safeParse({ name: 'Task One', projectId: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('projectId'));
      expect(issue?.message).toBe('VAL-25');
    }
  });
});
