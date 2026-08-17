import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../auth/auth.constants';

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

type AccessPayload = {
  userId: string;
  role: 'admin' | 'employee';
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(@Optional() @Inject(JWT_SECRET) private readonly jwtSecret?: string) {}

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
      const token = value.slice(7).trim();
      const secret = this.jwtSecret ?? process.env.JWT_SECRET ?? '';
      try {
        const payload = jwt.verify(token, secret) as AccessPayload;
        if (!payload.userId || (payload.role !== 'admin' && payload.role !== 'employee')) {
          throw new Error('invalid payload');
        }
        request.user = { id: payload.userId, role: payload.role };
      } catch {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Unauthorized',
          error: 'Unauthorized',
        });
      }
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
