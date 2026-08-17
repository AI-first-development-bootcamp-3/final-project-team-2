import { Module } from '@nestjs/common';
import { parseEnv } from '../env';
import { PrismaModule } from '../prisma/prisma.module';
import { JWT_SECRET } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    {
      provide: JWT_SECRET,
      useFactory: () => parseEnv().JWT_SECRET,
    },
    AuthService,
  ],
  exports: [JWT_SECRET],
})
export class AuthModule {}
