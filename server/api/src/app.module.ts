import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { MeModule } from './modules/me/me.module';

@Module({
  imports: [PrismaModule, UsersModule, ClientsModule, ProjectsModule, TasksModule, AssignmentsModule, MeModule],
  controllers: [AppController],
})
export class AppModule {}
