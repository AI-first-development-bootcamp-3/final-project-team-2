import { describe, it, expect } from 'vitest';
import { TasksListQuerySchema, TaskListItemSchema, TasksListSuccessSchema } from '../index';

describe('TasksListQuerySchema', () => {
  it('applies defaults for pagination, sort, order, includeDeleted', () => {
    const result = TasksListQuerySchema.parse({});
    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      sort: 'name',
      order: 'asc',
      includeDeleted: false,
    });
  });

  it('coerces string page and limit', () => {
    const result = TasksListQuerySchema.parse({ page: '2', limit: '15' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(15);
  });

  it('trims q search query', () => {
    expect(TasksListQuerySchema.parse({ q: '  task name  ' }).q).toBe('task name');
    expect(TasksListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('parses projectId and status', () => {
    const projectId = '550e8400-e29b-41d4-a716-446655440002';
    const result = TasksListQuerySchema.parse({
      projectId,
      status: 'open',
      includeDeleted: 'true',
    });
    expect(result.projectId).toBe(projectId);
    expect(result.status).toBe('open');
    expect(result.includeDeleted).toBe(true);
  });
});

describe('TaskListItemSchema', () => {
  it('accepts a valid task item', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Implement OAuth',
      projectId: '550e8400-e29b-41d4-a716-446655440002',
      projectName: 'Backend Revamp',
      clientName: 'Acme Corp',
      status: 'open' as const,
      description: 'Setup Google & GitHub OAuth',
    };
    expect(TaskListItemSchema.parse(item)).toEqual(item);
  });

  it('accepts null description', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Implement OAuth',
      projectId: '550e8400-e29b-41d4-a716-446655440002',
      projectName: 'Backend Revamp',
      clientName: 'Acme Corp',
      status: 'closed' as const,
      description: null,
    };
    expect(TaskListItemSchema.parse(item)).toEqual(item);
  });
});

describe('TasksListSuccessSchema', () => {
  it('validates success response list envelope', () => {
    const envelope = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Implement OAuth',
          projectId: '550e8400-e29b-41d4-a716-446655440002',
          projectName: 'Backend Revamp',
          clientName: 'Acme Corp',
          status: 'open' as const,
          description: null,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
    expect(TasksListSuccessSchema.parse(envelope)).toEqual(envelope);
  });
});
