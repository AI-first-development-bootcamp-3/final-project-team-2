import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from './auth.service';
import {
  REFRESH_COOKIE,
  REFRESH_TTL_DEFAULT_MS,
  REFRESH_TTL_REMEMBER_ME_MS,
} from './auth.constants';
import { makeAuthApp, makeFakeUser, decodeJwtPayload } from './auth.testing';

const CREDENTIALS = { email: 'employee1@abra.co', password: 'Employee123!' };

// Clock arithmetic for the fake-timer scenarios; the policy values under
// test are the named REFRESH_TTL_* constants.
const DAY_MS = 24 * 60 * 60 * 1000;

function cookieMaxAgeSeconds(setCookie: string): number {
  const match = /Max-Age=(\d+)/i.exec(setCookie);
  if (!match?.[1]) throw new Error(`no Max-Age in: ${setCookie}`);
  return Number(match[1]);
}

function refreshTtlSeconds(setCookie: string): number {
  const token = setCookie.split(';')[0]?.split('=')[1] ?? '';
  const payload = decodeJwtPayload(token);
  return (payload.exp as number) - (payload.iat as number);
}

describe('remember-me refresh durations', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await makeAuthApp([await makeFakeUser()]));
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
  });

  async function loginRefreshCookie(rememberMe: boolean): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ ...CREDENTIALS, rememberMe })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    if (!cookie) throw new Error('no refresh cookie');
    return cookie;
  }

  it('unchecked: cookie Max-Age and token claim both match the default TTL', async () => {
    const cookie = await loginRefreshCookie(false);
    expect(cookieMaxAgeSeconds(cookie)).toBe(REFRESH_TTL_DEFAULT_MS / 1000);
    expect(refreshTtlSeconds(cookie)).toBe(REFRESH_TTL_DEFAULT_MS / 1000);
  });

  it('unchecked: refresh is rejected 25 hours later even if the cookie survived', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cookie = await loginRefreshCookie(false);
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie.split(';')[0] ?? cookie)
      .expect(401);
  });

  it('checked: cookie Max-Age and token claim both match the remember-me TTL', async () => {
    const cookie = await loginRefreshCookie(true);
    expect(cookieMaxAgeSeconds(cookie)).toBe(REFRESH_TTL_REMEMBER_ME_MS / 1000);
    expect(refreshTtlSeconds(cookie)).toBe(REFRESH_TTL_REMEMBER_ME_MS / 1000);
  });

  it('checked: refresh succeeds at day 29 and fails at day 31', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cookie = (await loginRefreshCookie(true)).split(';')[0] ?? '';

    vi.advanceTimersByTime(29 * DAY_MS);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    vi.advanceTimersByTime(2 * DAY_MS);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('enforcement is claim-side: a preserved cookie past claim expiry is rejected (service level)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const service = app.get(AuthService);
    const { refreshToken } = await service.login({ ...CREDENTIALS, rememberMe: false });
    // Simulate a client that edited/kept the cookie: present the raw token
    // directly, long after its own claim expired.
    vi.advanceTimersByTime(2 * DAY_MS);
    await expect(service.refresh(refreshToken)).rejects.toThrow();
  });
});
