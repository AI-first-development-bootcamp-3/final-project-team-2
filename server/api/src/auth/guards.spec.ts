import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { JwtGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { Public, Auth, Roles } from './auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ENV } from '../env.provider';
import { makeFakePrisma, makeFakeUser, TEST_ENV, type FakeUser } from './auth.testing';

// Minimal route surface exercising every decorator the real app uses.
@Controller('probe')
class ProbeController {
  @Public()
  @Get('open')
  open() {
    return { ok: 'open' };
  }

  @Auth()
  @Get('any-user')
  anyUser() {
    return { ok: 'any-user' };
  }

  @Roles('admin')
  @Get('admin-only')
  adminOnly() {
    return { ok: 'admin-only' };
  }

  // No decorator at all — must still be protected (secure by default).
  @Get('bare')
  bare() {
    return { ok: 'bare' };
  }
}

async function makeGuardedApp(users: FakeUser[]): Promise<{
  app: INestApplication;
  prisma: ReturnType<typeof makeFakePrisma>;
}> {
  const prisma = makeFakePrisma(users);
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
    controllers: [ProbeController],
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

async function loginToken(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

describe('JwtGuard — default-protected routes (KAN-41 4.1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await makeGuardedApp([await makeFakeUser()]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets an untokened request through a @Public() route', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe/open').expect(200);
  });

  it('keeps login and refresh reachable without a token (public)', async () => {
    // Wrong-credential login must reach the handler (401 from the service,
    // not from the guard) — and refresh without a cookie likewise.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'WrongPass1!' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects an untokened request on a decorated protected route', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe/any-user').expect(401);
  });

  it('rejects an untokened request on an undecorated route (secure by default)', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe/bare').expect(401);
  });

  it('rejects a malformed bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/probe/any-user')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });

  it('serves a valid token on a protected route', async () => {
    const token = await loginToken(app, 'employee1@abra.co', 'Employee123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/probe/any-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ ok: 'any-user' });
  });
});

describe('RolesGuard — ADR-26 role matrix (KAN-41 4.2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await makeGuardedApp([
      await makeFakeUser(),
      await makeFakeUser({
        id: '0a1b2c3d-4e5f-6789-abcd-ef0123456789',
        email: 'admin@abra.co',
        full_name: 'Admin User',
        role: 'admin',
      }),
    ]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 403 for an employee token on an admin-only route', async () => {
    const token = await loginToken(app, 'employee1@abra.co', 'Employee123!');
    await request(app.getHttpServer())
      .get('/api/v1/probe/admin-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('serves an admin token on an employee route (admin keeps regular-user abilities)', async () => {
    const token = await loginToken(app, 'admin@abra.co', 'Employee123!');
    await request(app.getHttpServer())
      .get('/api/v1/probe/any-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('serves an admin token on an admin-only route', async () => {
    const token = await loginToken(app, 'admin@abra.co', 'Employee123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/probe/admin-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ ok: 'admin-only' });
  });
});

describe('RolesGuard — defensive unauthenticated branch', () => {
  it('throws Unauthorized if a roled route is reached with no user attached', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === 'roles' ? ['admin'] : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow();
  });
});

describe('Deactivated users are rejected on every request (KAN-41 4.3)', () => {
  let app: INestApplication;
  let users: FakeUser[];

  beforeAll(async () => {
    users = [await makeFakeUser()];
    ({ app } = await makeGuardedApp(users));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a live access token, a refresh, and a re-login after deactivation', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee1@abra.co', password: 'Employee123!' })
      .expect(200);
    const token = loginRes.body.accessToken as string;
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookie = (cookies.find((c) => c.startsWith('refresh_token=')) ?? '').split(';')[0] ?? '';

    // Sanity: the token works while active
    await request(app.getHttpServer())
      .get('/api/v1/probe/any-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    users[0].is_active = false;
    try {
      await request(app.getHttpServer())
        .get('/api/v1/probe/any-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);

      const reLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'employee1@abra.co', password: 'Employee123!' })
        .expect(401);
      expect(reLogin.body.message).toBe('Invalid credentials');
    } finally {
      users[0].is_active = true;
    }
  });
});
