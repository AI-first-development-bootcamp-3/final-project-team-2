import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  LoginSchema,
  type LoginFormData,
  type LoginResponse,
  type RefreshResponse,
} from '@abra/contracts';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE, refreshCookieOptions } from './auth.constants';
import { ZodValidationPipe } from './zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Validates credentials (VAL-01–VAL-04), returns a short-lived access JWT and sets the ' +
      'refresh token as an httpOnly, Secure, SameSite=Strict cookie. Remember-me controls the ' +
      'refresh lifetime.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'employee1@abra.co' },
        password: { type: 'string', minLength: 8, example: 'Employee123!' },
        rememberMe: { type: 'boolean', default: false },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token plus user summary; refresh cookie set.',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['employee', 'admin'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed — fields listed with VAL codes.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials (generic, no user enumeration).' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) credentials: LoginFormData,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(credentials);
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshMaxAgeMs));
    return result.response;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description:
      'Validates the httpOnly refresh cookie against the user’s token_version; revoked or ' +
      'expired tokens are rejected.',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token.',
    schema: { type: 'object', properties: { accessToken: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired, or revoked refresh token.' })
  refresh(@Req() req: Request): Promise<RefreshResponse> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.authService.refresh(cookies?.[REFRESH_COOKIE]);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Log out and revoke all refresh tokens',
    description:
      'Increments the user’s token_version (killing every outstanding refresh token) and ' +
      'clears the refresh cookie. Requires a valid access token.',
  })
  @ApiResponse({ status: 204, description: 'Logged out; refresh cookie cleared.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    // Interim token check until KAN-41's global JwtGuard owns authentication.
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: { userId: string };
    try {
      payload = await this.authService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException();
    }
    await this.authService.logout(payload.userId);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(0));
  }
}
