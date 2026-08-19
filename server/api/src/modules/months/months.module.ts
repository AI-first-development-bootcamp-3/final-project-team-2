import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { MonthsController } from './months.controller';
import { MonthsService } from './months.service';

// Auth is the global APP_GUARD pair (app.module.ts), same as /me and
// /time-entries — no guard providers of this module's own.
@Module({
  imports: [PrismaModule, TimeEntriesModule],
  controllers: [MonthsController],
  providers: [MonthsService],
})
export class MonthsModule {}
