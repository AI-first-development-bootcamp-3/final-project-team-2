import { Module } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsController],
  providers: [ClientsService, JwtGuard, RolesGuard],
})
export class ClientsModule {}
