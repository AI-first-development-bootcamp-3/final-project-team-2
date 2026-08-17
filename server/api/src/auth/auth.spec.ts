import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { LoginResponse } from '@abra/contracts';
import { AuthModule } from './auth.module';
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
// JWT signing) is exercised for real through the HTTP seam.
export function makeFakePrisma(users: FakeUser[]) {
  const match = (where: { email?: string; id?: string }) =>
    users.find(
      (u) =>
        (where.email === undefined || u.email === where.email) &&
        (where.id === undefined || u.id === where.id) &&
        u.deleted_at === null,
    ) ?? null;
  return {
    user: {
      findFirst: async ({ where }: { where: { email?: string; id?: string } }) => match(where),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { token_version: { increment: number } };
      }) => {
        const user = match(where);
        if (!user) throw new Error('user not found');
        user.token_version += data.token_version.increment;
        return user;
      },
    },
  };
}

export async function makeAuthApp(users: FakeUser[]): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
  })
    .overrideProvider(PrismaService)
    .useValue(makeFakePrisma(users))
    .overrideProvider(ENV)
    .useValue(TEST_ENV)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  await app.init();
  return app;
}

describe('POST /api/v1/auth/login (happy path)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeAuthApp([await makeFakeUser()]);
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
    app = await makeAuthApp([await makeFakeUser()]);
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
