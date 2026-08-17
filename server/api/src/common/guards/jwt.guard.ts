import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

export type AuthUser = {
  id: string;
  role: 'admin' | 'employee';
};

type AuthedRequest = {
  headers?: { authorization?: string | string[] };
  user?: AuthUser;
};

/**
 * KAN-39 blocker (T008): full JWT verification (signature, expiry, token_version,
 * is_active) and login are owned by the auth epic. This equivalent guard rejects
 * missing/empty Bearer tokens with 401 and requires `request.user` to already be
 * attached. Until KAN-39 verifies tokens and attaches the user, a Bearer header
 * alone is not a session — integration tests override this guard for authenticated
 * paths.
 */
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
    return true;
  }
}
