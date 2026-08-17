import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LoginResponse, RefreshResponse } from '@abra/contracts';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE } from './auth.constants';
import {
  makeAuthApp,
  makeFakeUser,
  makeFakePrisma,
  extractRefreshCookie,
  decodeJwtPayload,
} from './auth.testing';

describe('POST /api/v1/auth/login (happy path)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await makeAuthApp([await makeFakeUser()]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an access token and the user summary matching the contract', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);

    const parsed = LoginResponse.safeParse(res.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.user).toEqual({
        id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
        email: 'employee1@abra.co',
        fullName: 'Alice Cohen',
        role: 'employee',
      });
    }
  });

  it('sets the refresh token as an httpOnly, Secure, SameSite=Strict cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Secure/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });
});

describe('POST /api/v1/auth/login (failures)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await makeAuthApp([await makeFakeUser()]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a wrong password with a generic 401 and no cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'WrongPassword1!' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('answers an unknown email with the identical generic error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@abra.co', password: 'Whatever123!' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects a malformed email with a 400 naming the field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Employee123!' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('email');
    expect(JSON.stringify(res.body)).toContain('VAL-02');
  });

  it('rejects a short password with a 400 naming the field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'short' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('password');
    expect(JSON.stringify(res.body)).toContain('VAL-04');
  });
});

describe('POST /api/v1/auth/login (account state)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await makeAuthApp([
      await makeFakeUser({ is_active: false }),
      await makeFakeUser({
        id: '3f2a1b0c-9d8e-4f7a-b6c5-d4e3f2a1b0c9',
        email: 'deleted@abra.co',
        deleted_at: new Date('2026-08-01T00:00:00Z'),
      }),
    ]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a deactivated user with the same generic 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a soft-deleted user with the same generic 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'deleted@abra.co', password: 'Employee123!' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  let app: INestApplication;
  let user: Awaited<ReturnType<typeof makeFakeUser>>;

  beforeAll(async () => {
    user = await makeFakeUser();
    ({ app } = await makeAuthApp([user]));
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);
    return extractRefreshCookie(res);
  }

  it('issues a new access token for a valid refresh cookie', async () => {
    const cookie = await loginCookie();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    const parsed = RefreshResponse.safeParse(res.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const payload = decodeJwtPayload(parsed.data.accessToken);
      expect(payload.userId).toBe('7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e');
      expect(payload.role).toBe('employee');
    }
  });

  it('rejects a refresh without a cookie', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects a tampered refresh cookie', async () => {
    const cookie = await loginCookie();
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${cookie}tampered`)
      .expect(401);
  });

  it('rejects a refresh after the user is deactivated, even with a live token', async () => {
    const cookie = await loginCookie();
    user.is_active = false;
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    } finally {
      user.is_active = true;
    }
  });

  it('rejects a refresh token whose version no longer matches the user', async () => {
    const cookie = await loginCookie();
    user.token_version += 1;
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    } finally {
      user.token_version -= 1;
    }
  });
});

describe('POST /api/v1/auth/logout', () => {
  let app: INestApplication;
  let user: Awaited<ReturnType<typeof makeFakeUser>>;

  beforeAll(async () => {
    user = await makeFakeUser();
    ({ app } = await makeAuthApp([user]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('increments token_version, clears the cookie, and kills prior refresh tokens', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);
    const cookie = extractRefreshCookie(loginRes);
    const versionBefore = user.token_version;

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.accessToken as string}`)
      .expect(204);

    expect(user.token_version).toBe(versionBefore + 1);

    const clearCookie = (logoutRes.headers['set-cookie'] as unknown as string[])?.find((c) =>
      c.startsWith(`${REFRESH_COOKIE}=`),
    );
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects a logout without a valid access token', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });
});

describe('access token contract', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeAll(async () => {
    ({ app, prisma } = await makeAuthApp([await makeFakeUser()]));
  });

  afterAll(async () => {
    await app.close();
    vi.useRealTimers();
  });

  it('carries exactly { userId, role } plus standard claims, with ~15 min expiry', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);

    const payload = decodeJwtPayload(res.body.accessToken as string);
    expect(payload.userId).toBe('7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e');
    expect(payload.role).toBe('employee');
    expect(new Set(Object.keys(payload))).toEqual(new Set(['userId', 'role', 'iat', 'exp']));
    expect((payload.exp as number) - (payload.iat as number)).toBe(15 * 60);
  });

  it('rejects an expired access token without consulting the database', async () => {
    const service = app.get(AuthService);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { response } = await service.login({
        email: 'employee1@abra.co',
        password: 'Employee123!',
        rememberMe: false,
      });

      // Fresh token verifies fine
      await expect(service.verifyAccessToken(response.accessToken)).resolves.toMatchObject({
        userId: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
        role: 'employee',
      });

      const dbCallsAfterLogin = prisma.calls.user;
      vi.advanceTimersByTime(16 * 60 * 1000);
      await expect(service.verifyAccessToken(response.accessToken)).rejects.toThrow();
      expect(prisma.calls.user).toBe(dbCallsAfterLogin);
    } finally {
      vi.useRealTimers();
    }
  });
});
