import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
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

  it('attaches the user from a valid access token', () => {
    const token = jwt.sign({ userId: '1', role: 'admin' }, 'test-secret');
    const request: { headers: { authorization?: string }; user?: { id: string; role: string } } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
    const guard = new JwtGuard('test-secret');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual({ id: '1', role: 'admin' });
  });
});
