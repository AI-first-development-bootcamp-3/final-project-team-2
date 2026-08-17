import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { LoginFormData, LoginResponse, RefreshResponse } from '@abra/contracts';
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

  async refresh(refreshToken: string | undefined): Promise<RefreshResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    let payload: { userId: string; tokenVersion: number };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findFirst({ where: { id: payload.userId } });
    // token_version mismatch means the token was revoked (logout, password
    // reset, deactivation) after being issued.
    if (!user || user.token_version !== payload.tokenVersion) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { accessToken: await this.signAccessToken(user.id, user.role) };
  }

  /**
   * Revokes every outstanding refresh token for the user by bumping
   * token_version. Access tokens die at their natural (~15 min) expiry.
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { token_version: { increment: 1 } },
    });
  }

  /** Stateless check — signature + expiry only, never touches the database. */
  verifyAccessToken(token: string): Promise<{ userId: string; role: 'employee' | 'admin' }> {
    return this.jwt.verifyAsync(token, { secret: this.env.JWT_SECRET });
  }

  private signAccessToken(userId: string, role: 'employee' | 'admin'): Promise<string> {
    return this.jwt.signAsync(
      { userId, role },
      { secret: this.env.JWT_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );
  }
}
