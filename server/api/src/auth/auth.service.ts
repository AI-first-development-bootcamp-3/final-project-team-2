import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { LoginFormData, LoginResponse } from '@abra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ENV } from '../env.provider';
import type { Env } from '../env';
import { ACCESS_TOKEN_TTL, DAY_MS } from './auth.constants';

export interface LoginResult {
  response: LoginResponse;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(credentials: LoginFormData): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({ where: { email: credentials.email } });
    // Same generic error for unknown email and wrong password — the response
    // must not reveal whether the email exists.
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(credentials.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signAccessToken(user.id, user.role);
    const refreshMaxAgeMs = DAY_MS;
    const refreshToken = await this.jwt.signAsync(
      { userId: user.id, tokenVersion: user.token_version },
      { secret: this.env.JWT_REFRESH_SECRET, expiresIn: Math.floor(refreshMaxAgeMs / 1000) },
    );

    return {
      response: {
        accessToken,
        user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      },
      refreshToken,
      refreshMaxAgeMs,
    };
  }

  private signAccessToken(userId: string, role: 'employee' | 'admin'): Promise<string> {
    return this.jwt.signAsync(
      { userId, role },
      { secret: this.env.JWT_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );
  }
}
