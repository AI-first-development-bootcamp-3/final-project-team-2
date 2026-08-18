import { Module } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentScopeService } from './assignment-scope.service';
import { MonthLockService } from './month-lock.service';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, AssignmentScopeService, MonthLockService, JwtGuard, RolesGuard],
  // The Month Close and Absences epics need the same guards on their own
  // writes, so they are exported rather than kept module-private.
  exports: [AssignmentScopeService, MonthLockService],
})
export class TimeEntriesModule {}
