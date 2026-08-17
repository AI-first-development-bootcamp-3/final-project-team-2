import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@abra/contracts';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import type { AuthenticatedUser } from './jwt.guard';

/**
 * Runs after JwtGuard. Enforces @Roles(...) — a route with no roles metadata
 * accepts any authenticated user (ADR-26: admins keep all regular-user
 * abilities, so employee-app routes simply omit @Roles).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
