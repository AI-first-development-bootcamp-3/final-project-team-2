import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
<<<<<<< HEAD
import { JwtGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
=======
import { UsersModule } from './modules/users/users.module';
>>>>>>> feat/kan-70-admin-login

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [AppController],
  // Secure by default: every route requires a token unless @Public().
  // Order matters — JwtGuard authenticates, RolesGuard authorizes.
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
