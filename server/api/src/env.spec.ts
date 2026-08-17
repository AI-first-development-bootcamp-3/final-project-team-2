import { describe, it, expect } from 'vitest';
import { parseEnv, EnvValidationError } from './env';

const VALID_DB_URL = 'postgresql://user:pw@localhost:5432/db';
const VALID_JWT = 'test-jwt-signing-key';
const valid = { DATABASE_URL: VALID_DB_URL, JWT_SECRET: VALID_JWT };

describe('parseEnv', () => {
  it('applies defaults when DATABASE_URL and JWT_SECRET are set', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:5174']);
    expect(env.DATABASE_URL).toBe(VALID_DB_URL);
    expect(env.JWT_SECRET).toBe(VALID_JWT);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ JWT_SECRET: VALID_JWT })).toThrow(EnvValidationError);
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => parseEnv({ DATABASE_URL: VALID_DB_URL })).toThrow(EnvValidationError);
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('splits and trims CORS_ORIGINS, dropping empty entries', () => {
    const env = parseEnv({
      ...valid,
      CORS_ORIGINS: ' http://a.test , http://b.test ,, ',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('accepts postgresql:// and postgres:// DATABASE_URLs', () => {
    expect(
      parseEnv({ ...valid, DATABASE_URL: 'postgresql://user:pw@localhost:5432/db' }).DATABASE_URL,
    ).toBe('postgresql://user:pw@localhost:5432/db');
    expect(parseEnv({ ...valid, DATABASE_URL: 'postgres://user:pw@host/db' }).DATABASE_URL).toBe(
      'postgres://user:pw@host/db',
    );
  });

  it('rejects a DATABASE_URL with a different scheme', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://user:pw@host/db' })).toThrow(
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
