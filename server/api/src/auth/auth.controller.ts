import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
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
  refresh(@Req() req: Request): Promise<RefreshResponse> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.authService.refresh(cookies?.[REFRESH_COOKIE]);
  }

  @Post('logout')
  @HttpCode(204)
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
