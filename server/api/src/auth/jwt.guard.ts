import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@abra/contracts';
import { AuthService } from './auth.service';
import { isPublicContext } from './auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/** The request shape both guards share once JwtGuard has attached the user. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/**
 * Global guard: every route requires a valid access token unless marked
 * @Public(). Attaches the token payload to req.user for RolesGuard.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicContext(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.authService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Deliberate statefulness (spec): deactivation or soft-deletion takes
    // effect on the very next request, even while a token is still unexpired.
    const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.deleted_at !== null || !user.is_active) {
      throw new UnauthorizedException();
    }

    request.user = { userId: payload.userId, role: payload.role };
    return true;
  }
}
