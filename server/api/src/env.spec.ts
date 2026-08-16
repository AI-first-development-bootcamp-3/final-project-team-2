import { describe, it, expect } from 'vitest';
import { parseEnv, EnvValidationError } from './env';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:5174']);
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('splits and trims CORS_ORIGINS, dropping empty entries', () => {
    const env = parseEnv({ CORS_ORIGINS: ' http://a.test , http://b.test ,, ' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('accepts postgresql:// and postgres:// DATABASE_URLs', () => {
    expect(
      parseEnv({ DATABASE_URL: 'postgresql://user:pw@localhost:5432/db' }).DATABASE_URL,
    ).toBe('postgresql://user:pw@localhost:5432/db');
    expect(parseEnv({ DATABASE_URL: 'postgres://user:pw@host/db' }).DATABASE_URL).toBe(
      'postgres://user:pw@host/db',
    );
  });

  it('rejects a DATABASE_URL with a different scheme', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://user:pw@host/db' })).toThrow(
      EnvValidationError,
    );
  });

  it('names the offending keys in the error message', () => {
    try {
      parseEnv({ PORT: '-1', DATABASE_URL: 'not-a-url' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('PORT');
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).toContain('refusing to start');
    }
  });
});
