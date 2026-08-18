import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';

function contextWith(authorization?: string, user?: { id: string; role: 'admin' | 'employee' }) {
  const request: { headers: { authorization?: string }; user?: typeof user } = {
    headers: authorization ? { authorization } : {},
    user,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('JwtGuard', () => {
  const guard = new JwtGuard();

  it('rejects a missing bearer token', () => {
    expect(() => guard.canActivate(contextWith())).toThrow(UnauthorizedException);
  });

  it('rejects a bearer token when the user is not attached (KAN-39)', () => {
    expect(() => guard.canActivate(contextWith('Bearer abc'))).toThrow(UnauthorizedException);
  });

  it('allows a request with a bearer token and attached user', () => {
    expect(guard.canActivate(contextWith('Bearer abc', { id: '1', role: 'admin' }))).toBe(true);
  });
});
