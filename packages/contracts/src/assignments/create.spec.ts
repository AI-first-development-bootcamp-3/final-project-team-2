import { describe, it, expect } from 'vitest';
import { CreateAssignmentBodySchema } from '../index';

const validBody = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  taskId: '660e8400-e29b-41d4-a716-446655440000',
};

describe('CreateAssignmentBodySchema', () => {
  it('accepts a valid body', () => {
    expect(CreateAssignmentBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('rejects missing userId with VAL-26', () => {
    const result = CreateAssignmentBodySchema.safeParse({ taskId: validBody.taskId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-26');
    }
  });

  it('rejects missing taskId with VAL-26', () => {
    const result = CreateAssignmentBodySchema.safeParse({ userId: validBody.userId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-26');
    }
  });

  it('rejects invalid UUID userId with VAL-26', () => {
    const result = CreateAssignmentBodySchema.safeParse({ userId: 'bad', taskId: validBody.taskId });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('userId'));
      expect(issue?.message).toBe('VAL-26');
    }
  });
});
