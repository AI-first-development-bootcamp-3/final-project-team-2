import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { LoginFormData, LoginResponse } from '@abra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_SECRET } from './auth.constants';

const ACCESS_TOKEN_TTL = '15m';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JWT_SECRET) private readonly jwtSecret: string,
  ) {}

  async login(credentials: LoginFormData): Promise<LoginResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: credentials.email, mode: 'insensitive' },
      },
    });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(credentials.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }
}
