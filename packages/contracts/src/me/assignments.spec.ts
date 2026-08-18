import { describe, it, expect } from 'vitest';
import { MyAssignmentSchema, MyAssignmentsResponseSchema } from '../index';

const validAssignment = {
  taskId: '550e8400-e29b-41d4-a716-446655440000',
  taskName: 'Task One',
  projectId: '660e8400-e29b-41d4-a716-446655440000',
  projectName: 'Project Alpha',
  clientId: '770e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  reportType: 'TOTAL_HOURS' as const,
};

describe('MyAssignmentSchema', () => {
  it('accepts a valid assignment', () => {
    expect(MyAssignmentSchema.parse(validAssignment)).toEqual(validAssignment);
  });
});

describe('MyAssignmentsResponseSchema', () => {
  it('accepts a valid response envelope', () => {
    const response = { data: [validAssignment] };
    expect(MyAssignmentsResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts empty data array', () => {
    const response = { data: [] };
    expect(MyAssignmentsResponseSchema.parse(response)).toEqual(response);
  });
});
