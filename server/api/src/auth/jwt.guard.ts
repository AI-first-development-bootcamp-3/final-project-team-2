import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  role: 'employee' | 'admin';
}

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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
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

    // Deliberate statefulness (spec): deactivation takes effect on the very
    // next request, even while an access token is still unexpired.
    const user = await this.prisma.user.findFirst({ where: { id: payload.userId } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException();
    }

    request.user = { userId: payload.userId, role: payload.role };
    return true;
  }
}
