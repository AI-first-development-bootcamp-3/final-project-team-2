import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MyAssignment } from '@abra/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtGuard, RolesGuard)
@Roles('employee')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('assignments')
  @ApiOperation({ summary: 'Get my task assignments (employee)' })
  async myAssignments(@Req() req: { user: { id: string } }) {
    const rows = await this.prisma.taskAssignment.findMany({
      where: {
        user_id: req.user.id,
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
    }));

    return { data };
  }
}
