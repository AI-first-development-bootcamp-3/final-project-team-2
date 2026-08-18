import { describe, it, expect } from 'vitest';
import { CreateClientBodySchema } from '../index';

const validBody = { name: 'Acme Corp' };

describe('CreateClientBodySchema', () => {
  it('accepts a valid body with name only', () => {
    expect(CreateClientBodySchema.parse(validBody)).toEqual(validBody);
  });

  it('accepts name with optional contactInfo', () => {
    const body = { name: 'Acme Corp', contactInfo: 'info@acme.com' };
    expect(CreateClientBodySchema.parse(body)).toEqual(body);
  });

  it('trims name', () => {
    expect(CreateClientBodySchema.parse({ name: '  Acme  ' }).name).toBe('Acme');
  });

  it('rejects empty name with VAL-20', () => {
    const result = CreateClientBodySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-20');
    }
  });

  it('rejects whitespace-only name with VAL-20', () => {
    const result = CreateClientBodySchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-20');
    }
  });

  it('rejects missing name with VAL-20', () => {
    const result = CreateClientBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('VAL-20');
    }
  });
});
