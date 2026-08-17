import {
  Injectable,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from './jwt.guard';

type AuthedRequest = {
  user?: AuthUser;
};

/**
 * KAN-39 equivalent RolesGuard: compares `request.user.role` to `@Roles()`.
 * JwtGuard must run first so `request.user` is present for authenticated calls.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<'admin' | 'employee'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const role = request.user?.role;
    if (!role || !roles.includes(role)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Forbidden',
        error: 'Forbidden',
      });
    }
    return true;
  }
}
