import { Test } from '@nestjs/testing';
import {
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import type { UserRole } from '@abra/contracts';
import { AuthModule } from './auth.module';
import { JwtGuard, type AuthenticatedUser } from './jwt.guard';
import { RolesGuard } from './roles.guard';
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
  role: UserRole;
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
// findUnique deliberately does NOT filter deleted_at/is_active — that is the
// service's job, and the fake must not mask a missing check.
export function makeFakePrisma(users: FakeUser[]) {
  const calls = { user: 0 };
  const match = (where: { email?: string; id?: string }) =>
    users.find(
      (u) =>
        (where.email === undefined || u.email === where.email) &&
        (where.id === undefined || u.id === where.id),
    ) ?? null;
  return {
    calls,
    user: {
      findFirst: async ({ where }: { where: { email?: string; id?: string } }) => {
        calls.user += 1;
        return match(where);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
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

export async function makeAuthApp(
  users: FakeUser[],
  extraControllers: Parameters<typeof Test.createTestingModule>[0]['controllers'] = [],
): Promise<{
  app: INestApplication;
  prisma: ReturnType<typeof makeFakePrisma>;
}> {
  const prisma = makeFakePrisma(users);
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
    controllers: extraControllers,
    // Mirror production (app.module.ts): the global JwtGuard → RolesGuard
    // pipeline is part of the surface under test, not an add-on.
    providers: [
      Reflector,
      { provide: APP_GUARD, useClass: JwtGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
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

/**
 * APP_GUARD providers for module specs, mirroring production's guard order:
 * a stub authenticator that attaches `user` (or rejects when null, like the
 * real JwtGuard with no token) followed by the REAL RolesGuard, so @Roles()
 * enforcement is part of what module tests exercise.
 */
export function stubAuthGuards(user: AuthenticatedUser | null) {
  return [
    {
      provide: APP_GUARD,
      useValue: {
        canActivate(context: ExecutionContext) {
          if (!user) throw new UnauthorizedException();
          context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user = user;
          return true;
        },
      },
    },
    { provide: APP_GUARD, useClass: RolesGuard },
  ];
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
