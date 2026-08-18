import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  VAL_MESSAGES,
  type AssignmentListItem,
  type AssignmentsListQuery,
  type CreateAssignmentBody,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const ASSIGNMENT_LIST_SELECT = {
  id: true,
  user_id: true,
  task_id: true,
  user: { select: { full_name: true, email: true } },
  task: {
    select: {
      name: true,
      project: {
        select: {
          name: true,
          client: { select: { name: true } },
        },
      },
    },
  },
} as const;

type AssignmentRow = {
  id: string;
  user_id: string;
  task_id: string;
  user: { full_name: string; email: string };
  task: { name: string; project: { name: string; client: { name: string } } };
};

function toListItem(row: AssignmentRow): AssignmentListItem {
  return {
    id: row.id,
    userId: row.user_id,
    userFullName: row.user.full_name,
    userEmail: row.user.email,
    taskId: row.task_id,
    taskName: row.task.name,
    projectName: row.task.project.name,
    clientName: row.task.project.client.name,
  };
}

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: AssignmentsListQuery,
  ): Promise<{ data: AssignmentListItem[]; meta: { page: number; limit: number; total: number } }> {
    const where = this.buildWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.taskAssignment.findMany({
        where,
        select: ASSIGNMENT_LIST_SELECT,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.taskAssignment.count({ where }),
    ]);

    return {
      data: (rows as AssignmentRow[]).map(toListItem),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async create(input: CreateAssignmentBody): Promise<AssignmentListItem> {
    const [user, task] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, deleted_at: true },
      }),
      this.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, deleted_at: true },
      }),
    ]);

    if (!user || user.deleted_at || !task || task.deleted_at) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        details: [
          {
            field: 'userId,taskId',
            rule: 'VAL-26',
            message: VAL_MESSAGES['VAL-26'],
          },
        ],
      });
    }

    try {
      const row = await this.prisma.taskAssignment.create({
        data: {
          user_id: input.userId,
          task_id: input.taskId,
        },
        select: ASSIGNMENT_LIST_SELECT,
      });
      return toListItem(row as AssignmentRow);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          message: 'Conflict',
          error: 'Conflict',
          details: [
            {
              field: 'userId,taskId',
              rule: 'VAL-27',
              message: VAL_MESSAGES['VAL-27'],
            },
          ],
        });
      }
      throw error;
    }
  }

  async hardDelete(id: string): Promise<void> {
    const existing = await this.prisma.taskAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('שיוך לא נמצא');
    }

    await this.prisma.taskAssignment.delete({ where: { id } });
  }

  private buildWhere(query: AssignmentsListQuery): Prisma.TaskAssignmentWhereInput {
    const and: Prisma.TaskAssignmentWhereInput[] = [];

    if (query.userId) {
      and.push({ user_id: query.userId });
    }

    if (query.taskId) {
      and.push({ task_id: query.taskId });
    }

    if (query.q) {
      and.push({
        OR: [
          { user: { full_name: { contains: query.q, mode: 'insensitive' } } },
          { user: { email: { contains: query.q, mode: 'insensitive' } } },
          { task: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }
}
