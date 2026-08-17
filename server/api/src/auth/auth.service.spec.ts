import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
}));

const prisma = {
  user: {
    findFirst: vi.fn(),
  },
};

const alice = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@abra.co',
  full_name: 'Admin User',
  password_hash: 'hashed',
  role: 'admin' as const,
  is_active: true,
};

describe('AuthService', () => {
  const service = new AuthService(prisma as never, 'test-jwt-signing-key');

  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  it('returns an access token for valid admin credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(alice);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await service.login({
      email: 'admin@abra.co',
      password: 'Admin123!',
      rememberMe: false,
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).toEqual({
      id: alice.id,
      email: alice.email,
      fullName: alice.full_name,
      role: 'admin',
    });
  });

  it('rejects unknown, inactive, and wrong-password logins with the same error', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.login({ email: 'nobody@abra.co', password: 'Admin123!', rememberMe: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValue({ ...alice, is_active: false });
    await expect(
      service.login({ email: 'admin@abra.co', password: 'Admin123!', rememberMe: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValue(alice);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(
      service.login({ email: 'admin@abra.co', password: 'wrongpass', rememberMe: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
