import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL = '15m';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}
