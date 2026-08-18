import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MyAssignment } from '@abra/contracts';
import type { AuthenticatedUser } from '../../auth/jwt.guard';
import { Roles } from '../../auth/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@Roles('employee')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('assignments')
  @ApiOperation({ summary: 'Get my task assignments (employee)' })
  async myAssignments(@Req() req: { user: AuthenticatedUser }) {
    const rows = await this.prisma.taskAssignment.findMany({
      where: {
        user_id: req.user.userId,
        task: {
          status: 'open',
          deleted_at: null,
          project: {
            is_active: true,
            deleted_at: null,
            client: {
              is_active: true,
              deleted_at: null,
            },
          },
        },
      },
      select: {
        task: {
          select: {
            id: true,
            name: true,
            project: {
              select: {
                id: true,
                name: true,
                report_type: true,
                client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const data: MyAssignment[] = rows.map((row) => ({
      taskId: row.task.id,
      taskName: row.task.name,
      projectId: row.task.project.id,
      projectName: row.task.project.name,
      clientId: row.task.project.client.id,
      clientName: row.task.project.client.name,
      reportType: row.task.project.report_type,
    }));

    return { data };
  }
}
