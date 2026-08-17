import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@abra/contracts';
import { ROLES_KEY, isPublicContext } from './auth.decorators';
import type { AuthenticatedRequest } from './jwt.guard';

/**
 * Runs after JwtGuard. Enforces @Roles(...) — a route with no roles metadata
 * accepts any authenticated user (ADR-26: admins keep all regular-user
 * abilities, so employee-app routes simply omit @Roles).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicContext(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Non-public routes must have passed JwtGuard; a missing user here means
    // a guard-ordering bug, not a client error — fail closed either way.
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      // No @Roles restriction: any authenticated user (@Auth() or bare route).
      return true;
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
