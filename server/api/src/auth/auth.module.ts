import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { envProvider } from '../env.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Secrets are passed per-sign/per-verify from the injected env, so the
  // JwtModule itself carries no global secret.
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, envProvider],
  exports: [AuthService],
})
export class AuthModule {}
