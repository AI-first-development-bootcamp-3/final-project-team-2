import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts a valid DATABASE_URL', () => {
    const env = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' };
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow('DATABASE_URL');
  });

  it('rejects a non-postgres URL', () => {
    const env = { DATABASE_URL: 'mysql://user:pass@localhost:3306/db' };
    expect(() => validateEnv(env)).toThrow();
  });
});
