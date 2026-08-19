import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentScopeService } from './assignment-scope.service';
import { MonthLockService } from './month-lock.service';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, AssignmentScopeService, MonthLockService],
  // The Month Close and Absences epics need the same assignment and lock
  // checks on their own writes, so they are exported rather than kept
  // module-private. Auth is the global APP_GUARD pair, same as /me.
  exports: [AssignmentScopeService, MonthLockService],
})
export class TimeEntriesModule {}
