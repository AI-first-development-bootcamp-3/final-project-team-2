import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { UserRole } from '@abra/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRES_AUTH_KEY = 'requiresAuth';
export const ROLES_KEY = 'roles';

/** Opts a route out of authentication — login, refresh, and health only. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Any authenticated user (employee or admin). Not a no-op: it beats @Public
 * at a broader scope, so a single handler inside a @Public() controller can
 * still demand a valid token.
 */
export const Auth = () => SetMetadata(REQUIRES_AUTH_KEY, true);

/** Restricts a route to the given roles (ADR-26: admin-console routes use @Roles('admin')). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Shared @Public resolution for JwtGuard and RolesGuard: public only when
 * marked @Public() and not overridden by @Auth() or @Roles() nearer the
 * handler.
 */
export function isPublicContext(reflector: Reflector, context: ExecutionContext): boolean {
  const targets = [context.getHandler(), context.getClass()];
  const markedPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
  const requiresAuth = reflector.getAllAndOverride<boolean>(REQUIRES_AUTH_KEY, targets);
  const roles = reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
  return Boolean(markedPublic) && !requiresAuth && (roles === undefined || roles.length === 0);
}
