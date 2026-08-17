import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
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

export type FakeUser = {
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

export function extractRefreshCookie(res: Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = cookies?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('no refresh cookie set');
  return cookie.split(';')[0] ?? cookie;
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const payloadPart = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as Record<string, unknown>;
}
