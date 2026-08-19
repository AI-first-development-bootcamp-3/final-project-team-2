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
  type AssignmentsByTaskItem,
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

  // KAN-122 (Admin Web Portal Spec §4.2): one row per task with the employees
  // assigned to it. A task matches the filters when ANY of its assignments
  // matches (e.g. q matches one employee), but the row always carries the full
  // employee list. Pagination and total are computed at the task level.
  async listGroupedByTask(query: AssignmentsListQuery): Promise<{
    data: AssignmentsByTaskItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const where = this.buildGroupedWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: {
          id: true,
          name: true,
          project: { select: { name: true, client: { select: { name: true } } } },
          task_assignments: {
            select: {
              id: true,
              user_id: true,
              user: { select: { full_name: true, email: true } },
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { name: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    type GroupedRow = {
      id: string;
      name: string;
      project: { name: string; client: { name: string } };
      task_assignments: Array<{
        id: string;
        user_id: string;
        user: { full_name: string; email: string };
      }>;
    };

    return {
      data: (rows as GroupedRow[]).map((row) => ({
        taskId: row.id,
        taskName: row.name,
        projectName: row.project.name,
        clientName: row.project.client.name,
        employees: row.task_assignments.map((assignment) => ({
          assignmentId: assignment.id,
          userId: assignment.user_id,
          userFullName: assignment.user.full_name,
          userEmail: assignment.user.email,
        })),
      })),
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

  // Task-level filters for the grouped view: a task is included when at least
  // one of its assignments matches. q searches by employee name/email (§4.1).
  private buildGroupedWhere(query: AssignmentsListQuery): Prisma.TaskWhereInput {
    const assignmentFilter: Prisma.TaskAssignmentWhereInput[] = [];

    if (query.userId) {
      assignmentFilter.push({ user_id: query.userId });
    }

    if (query.q) {
      assignmentFilter.push({
        OR: [
          { user: { full_name: { contains: query.q, mode: 'insensitive' } } },
          { user: { email: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.TaskWhereInput = {
      deleted_at: null,
      task_assignments: {
        some: assignmentFilter.length > 0 ? { AND: assignmentFilter } : {},
      },
    };

    if (query.taskId) {
      where.id = query.taskId;
    }

    return where;
  }
}
