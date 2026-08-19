import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { MeModule } from './modules/me/me.module';
import { TimeEntriesModule } from './modules/time-entries/time-entries.module';
import { AbsencesModule } from './modules/absences/absences.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    AssignmentsModule,
    MeModule,
    TimeEntriesModule,
    AbsencesModule,
  ],
  controllers: [AppController],
  // Secure by default: every route requires a token unless @Public().
  // Order matters — JwtGuard authenticates, RolesGuard authorizes.
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
