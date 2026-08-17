import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function contextWith(role?: 'admin' | 'employee') {
  const request = { user: role ? { id: '1', role } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('RolesGuard', () => {
  it('allows when no roles metadata is set', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith('employee'))).toBe(true);
  });

  it('forbids an employee from an admin route', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES_KEY ? ['admin'] : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWith('employee'))).toThrow(ForbiddenException);
  });

  it('allows an admin on an admin route', () => {
    const reflector = {
      getAllAndOverride: () => ['admin'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWith('admin'))).toBe(true);
  });
});
