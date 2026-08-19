import { Module } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { MonthsController } from './months.controller';
import { MonthsService } from './months.service';

@Module({
  imports: [PrismaModule, TimeEntriesModule],
  controllers: [MonthsController],
  providers: [MonthsService, JwtGuard, RolesGuard],
})
export class MonthsModule {}
