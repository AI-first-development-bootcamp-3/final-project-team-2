import { Module } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { MeController } from './me.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [JwtGuard, RolesGuard],
})
export class MeModule {}
