import { describe, it, expect } from 'vitest';
import { DeactivateUserResponseSchema, RestoreUserResponseSchema } from './deactivate';

describe('DeactivateUserResponseSchema & RestoreUserResponseSchema', () => {
  it('validates deactivate response payload', () => {
    const valid = DeactivateUserResponseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isActive: false,
      deletedAt: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);
  });

  it('validates restore response payload', () => {
    const valid = RestoreUserResponseSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isActive: true,
      deletedAt: null,
    });
    expect(valid.success).toBe(true);
  });
});
