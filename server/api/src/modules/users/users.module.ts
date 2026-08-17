import { Module } from '@nestjs/common';
import { JWT_SECRET } from '../../auth/auth.constants';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    JwtGuard,
    RolesGuard,
    {
      provide: JWT_SECRET,
      useFactory: () => process.env.JWT_SECRET ?? 'test-jwt-signing-key',
    },
  ],
})
export class UsersModule {}
