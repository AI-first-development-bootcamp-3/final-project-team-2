import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LoginSchema, type LoginFormData, type LoginResponse } from '@abra/contracts';
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
}
