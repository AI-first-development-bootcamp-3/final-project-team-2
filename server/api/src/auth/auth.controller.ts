import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
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
import { Public } from './auth.decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Validates credentials (VAL-01–VAL-04), returns a short-lived access JWT and sets the ' +
      'refresh token as an httpOnly, Secure, SameSite=Strict cookie. rememberMe controls the ' +
      'refresh lifetime: 1 day unchecked, 30 days checked (ADR-16).',
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

  @Public()
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
    description: 'New access token plus the user summary (for session bootstrap).',
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
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired, or revoked refresh token.' })
  refresh(@Req() req: Request): Promise<RefreshResponse> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.authService.refresh(cookies?.[REFRESH_COOKIE]);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Log out and revoke all refresh tokens',
    description:
      'Identifies the user from a valid access token or, if that is missing or expired, from ' +
      'the refresh cookie (same verification as refresh). Increments token_version when a user ' +
      'is identified and always clears the refresh cookie. Idempotent: returns 204 even with ' +
      'no usable credentials.',
  })
  @ApiResponse({ status: 204, description: 'Logged out; refresh cookie cleared.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const userId = await this.authService.identifyLogoutUser(req);
    if (userId) {
      await this.authService.logout(userId);
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(0));
  }
}
