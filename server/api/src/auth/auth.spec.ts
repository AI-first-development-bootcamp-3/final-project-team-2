import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { LoginResponse, RefreshResponse } from '@abra/contracts';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE } from './auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ENV } from '../env.provider';

export const TEST_ENV = {
  PORT: 3000,
  CORS_ORIGINS: ['http://localhost:5173'],
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
};

type FakeUser = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: 'employee' | 'admin';
  is_active: boolean;
  token_version: number;
  deleted_at: Date | null;
};

export async function makeFakeUser(overrides: Partial<FakeUser> = {}): Promise<FakeUser> {
  return {
    id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
    email: 'employee1@abra.co',
    full_name: 'Alice Cohen',
    password_hash: await bcrypt.hash('Employee123!', 4),
    role: 'employee',
    is_active: true,
    token_version: 0,
    deleted_at: null,
    ...overrides,
  };
}

// Fakes the Prisma boundary only — everything inward (controller, service,
// JWT signing) is exercised for real through the HTTP seam. `calls` counts
// DB touches so tests can assert stateless paths never reach the database.
export function makeFakePrisma(users: FakeUser[]) {
  const calls = { user: 0 };
  const match = (where: { email?: string; id?: string }) =>
    users.find(
      (u) =>
        (where.email === undefined || u.email === where.email) &&
        (where.id === undefined || u.id === where.id) &&
        u.deleted_at === null,
    ) ?? null;
  return {
    calls,
    user: {
      findFirst: async ({ where }: { where: { email?: string; id?: string } }) => {
        calls.user += 1;
        return match(where);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { token_version: { increment: number } };
      }) => {
        calls.user += 1;
        const user = match(where);
        if (!user) throw new Error('user not found');
        user.token_version += data.token_version.increment;
        return user;
      },
    },
  };
}

export async function makeAuthApp(users: FakeUser[]): Promise<{
  app: INestApplication;
  prisma: ReturnType<typeof makeFakePrisma>;
}> {
  const prisma = makeFakePrisma(users);
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(ENV)
    .useValue(TEST_ENV)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  await app.init();
  return { app, prisma };
}

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

export function extractRefreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = cookies?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('no refresh cookie set');
  return cookie.split(';')[0];
}

describe('POST /api/v1/auth/refresh', () => {
  let app: INestApplication;
  let users: Awaited<ReturnType<typeof makeFakeUser>>[];

  beforeAll(async () => {
    users = [await makeFakeUser()];
    ({ app } = await makeAuthApp(users));
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

  it('rejects a refresh token whose version no longer matches the user', async () => {
    const cookie = await loginCookie();
    users[0].token_version += 1;
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    } finally {
      users[0].token_version -= 1;
    }
  });
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<
    string,
    unknown
  >;
}

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
