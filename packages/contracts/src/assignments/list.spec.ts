import { describe, it, expect } from 'vitest';
import {
  AssignmentsListQuerySchema,
  AssignmentListItemSchema,
  AssignmentsListSuccessSchema,
  AssignmentsByTaskItemSchema,
  AssignmentsByTaskListSuccessSchema,
} from '../index';

describe('AssignmentsListQuerySchema', () => {
  it('applies defaults for pagination', () => {
    const result = AssignmentsListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, limit: 20 });
  });

  it('parses optional userId, taskId, and q filter parameters', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440004';
    const taskId = '550e8400-e29b-41d4-a716-446655440003';
    const result = AssignmentsListQuerySchema.parse({ userId, taskId, q: '  john  ' });
    expect(result.userId).toBe(userId);
    expect(result.taskId).toBe(taskId);
    expect(result.q).toBe('john');
  });

  it('returns undefined for empty q query string', () => {
    expect(AssignmentsListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('parses groupBy=task and order, defaulting order to asc', () => {
    expect(AssignmentsListQuerySchema.parse({}).groupBy).toBeUndefined();
    expect(AssignmentsListQuerySchema.parse({}).order).toBe('asc');
    const result = AssignmentsListQuerySchema.parse({ groupBy: 'task', order: 'desc' });
    expect(result.groupBy).toBe('task');
    expect(result.order).toBe('desc');
  });

  it('rejects unsupported groupBy values', () => {
    expect(AssignmentsListQuerySchema.safeParse({ groupBy: 'project' }).success).toBe(false);
  });
});

describe('AssignmentListItemSchema', () => {
  it('accepts valid assignment item', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440005',
      userId: '550e8400-e29b-41d4-a716-446655440004',
      userFullName: 'John Doe',
      userEmail: 'john@example.com',
      taskId: '550e8400-e29b-41d4-a716-446655440003',
      taskName: 'Implement OAuth',
      projectName: 'Backend Revamp',
      clientName: 'Acme Corp',
    };
    expect(AssignmentListItemSchema.parse(item)).toEqual(item);
  });
});

describe('AssignmentsListSuccessSchema', () => {
  it('validates success response list envelope', () => {
    const envelope = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440005',
          userId: '550e8400-e29b-41d4-a716-446655440004',
          userFullName: 'John Doe',
          userEmail: 'john@example.com',
          taskId: '550e8400-e29b-41d4-a716-446655440003',
          taskName: 'Implement OAuth',
          projectName: 'Backend Revamp',
          clientName: 'Acme Corp',
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(AssignmentsListSuccessSchema.parse(envelope)).toEqual(envelope);
  });
});

describe('AssignmentsByTaskItemSchema', () => {
  const item = {
    taskId: '550e8400-e29b-41d4-a716-446655440003',
    taskName: 'Implement OAuth',
    projectName: 'Backend Revamp',
    clientName: 'Acme Corp',
    employees: [
      {
        assignmentId: '550e8400-e29b-41d4-a716-446655440005',
        userId: '550e8400-e29b-41d4-a716-446655440004',
        userFullName: 'John Doe',
        userEmail: 'john@example.com',
      },
    ],
  };

  it('accepts one row per task with an employees array', () => {
    expect(AssignmentsByTaskItemSchema.parse(item)).toEqual(item);
  });

  it('validates the grouped list envelope', () => {
    const envelope = { data: [item], meta: { page: 1, limit: 20, total: 1 } };
    expect(AssignmentsByTaskListSuccessSchema.parse(envelope)).toEqual(envelope);
  });
});
