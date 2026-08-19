import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { AbsenceLockService } from './absence-lock.service';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';

/**
 * Absence reporting.
 *
 * `MonthLockService` is imported rather than re-implemented: the daily
 * reporting epic exported it from `TimeEntriesModule` for exactly this reason,
 * and the lock's read semantics are the same wherever they are consulted. This
 * module owns only the §7.3 matrix layered on top. Auth is the global
 * APP_GUARD pair, same as every other module.
 */
@Module({
  imports: [PrismaModule, TimeEntriesModule],
  controllers: [AbsencesController],
  providers: [AbsencesService, AbsenceLockService],
  // The Month Close epic needs the same matrix for its pre-lock checks.
  exports: [AbsencesService, AbsenceLockService],
})
export class AbsencesModule {}
