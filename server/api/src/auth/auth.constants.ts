import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL = '15m';

// Refresh-cookie lifetime policy (ADR-16 §5.2): 1 day by default, 30 days
// when "remember me" is checked. Single source for cookie Max-Age and the
// refresh JWT's expiresIn.
export const REFRESH_TTL_DEFAULT_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TTL_REMEMBER_ME_MS = 30 * REFRESH_TTL_DEFAULT_MS;

export function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}
