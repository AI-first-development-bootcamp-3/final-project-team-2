import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

export type AuthUser = {
  id: string;
  role: 'admin' | 'employee';
  isActive?: boolean;
  is_active?: boolean;
};

type AuthedRequest = {
  headers?: { authorization?: string | string[] };
  user?: AuthUser;
};

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== 'string' || !value.startsWith('Bearer ') || !value.slice(7).trim()) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      });
    }
    if (!request.user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      });
    }
    if (request.user.isActive === false || request.user.is_active === false) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'משתמש זה אינו פעיל',
        error: 'Unauthorized',
      });
    }
    return true;
  }
}
