import { describe, it, expect } from 'vitest';
import { parseEnv, EnvValidationError } from './env';

const VALID_DB_URL = 'postgresql://user:pw@localhost:5432/db';
const VALID_SECRETS = {
  JWT_SECRET: 'access-secret-value',
  JWT_REFRESH_SECRET: 'refresh-secret-value',
};

describe('parseEnv', () => {
  it('applies defaults when only the required variables are set', () => {
    const env = parseEnv({ DATABASE_URL: VALID_DB_URL, ...VALID_SECRETS });
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:5174']);
    expect(env.DATABASE_URL).toBe(VALID_DB_URL);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({ PORT: '8080', DATABASE_URL: VALID_DB_URL, ...VALID_SECRETS }).PORT).toBe(
      8080,
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ PORT: 'abc', DATABASE_URL: VALID_DB_URL, ...VALID_SECRETS })).toThrow(
      EnvValidationError,
    );
  });

  it('splits and trims CORS_ORIGINS, dropping empty entries', () => {
    const env = parseEnv({
      CORS_ORIGINS: ' http://a.test , http://b.test ,, ',
      DATABASE_URL: VALID_DB_URL,
      ...VALID_SECRETS,
    });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('accepts postgresql:// and postgres:// DATABASE_URLs', () => {
    expect(
      parseEnv({ DATABASE_URL: 'postgresql://user:pw@localhost:5432/db', ...VALID_SECRETS })
        .DATABASE_URL,
    ).toBe('postgresql://user:pw@localhost:5432/db');
    expect(
      parseEnv({ DATABASE_URL: 'postgres://user:pw@host/db', ...VALID_SECRETS }).DATABASE_URL,
    ).toBe('postgres://user:pw@host/db');
  });

  it('rejects a DATABASE_URL with a different scheme', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://user:pw@host/db' })).toThrow(EnvValidationError);
  });

  it('throws naming JWT_SECRET when it is missing', () => {
    try {
      parseEnv({ DATABASE_URL: VALID_DB_URL, JWT_REFRESH_SECRET: 'refresh-secret-value' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('JWT_SECRET');
    }
  });

  it('throws naming JWT_REFRESH_SECRET when it is missing or empty', () => {
    try {
      parseEnv({
        DATABASE_URL: VALID_DB_URL,
        JWT_SECRET: 'access-secret-value',
        JWT_REFRESH_SECRET: '',
      });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('JWT_REFRESH_SECRET');
    }
  });

  it('boots normally when both JWT secrets are non-empty', () => {
    const env = parseEnv({
      DATABASE_URL: VALID_DB_URL,
      JWT_SECRET: 'access-secret-value',
      JWT_REFRESH_SECRET: 'refresh-secret-value',
    });
    expect(env.JWT_SECRET).toBe('access-secret-value');
    expect(env.JWT_REFRESH_SECRET).toBe('refresh-secret-value');
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
