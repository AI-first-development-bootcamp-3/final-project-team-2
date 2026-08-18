import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  VAL_MESSAGES,
  type TaskListItem,
  type TasksListQuery,
  type CreateTaskBody,
  type UpdateTaskBody,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const SORT_COLUMN: Record<
  TasksListQuery['sort'],
  keyof Prisma.TaskOrderByWithRelationInput
> = {
  name: 'name',
  status: 'status',
};

const TASK_LIST_SELECT = {
  id: true,
  name: true,
  project_id: true,
  status: true,
  description: true,
  project: {
    select: {
      name: true,
      client: { select: { name: true } },
    },
  },
} as const;

type TaskRow = {
  id: string;
  name: string;
  project_id: string;
  status: 'open' | 'closed';
  description: string | null;
  project: { name: string; client: { name: string } };
};

function toListItem(row: TaskRow): TaskListItem {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    projectName: row.project.name,
    clientName: row.project.client.name,
    status: row.status,
    description: row.description,
  };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: TasksListQuery,
  ): Promise<{ data: TaskListItem[]; meta: { page: number; limit: number; total: number } }> {
    const where = this.buildWhere(query);
    const orderBy = {
      [SORT_COLUMN[query.sort]]: query.order,
    } as Prisma.TaskOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: TASK_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: (rows as TaskRow[]).map(toListItem),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: string): Promise<TaskListItem> {
    const row = await this.prisma.task.findUnique({
      where: { id },
      select: TASK_LIST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('משימה לא נמצאה');
    }
    return toListItem(row as TaskRow);
  }

  async create(input: CreateTaskBody): Promise<TaskListItem> {
    await this.validateProjectId(input.projectId);

    const row = await this.prisma.task.create({
      data: {
        name: input.name,
        project_id: input.projectId,
        description: input.description ?? null,
      },
      select: TASK_LIST_SELECT,
    });
    return toListItem(row as TaskRow);
  }

  async update(id: string, payload: UpdateTaskBody): Promise<TaskListItem> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('משימה לא נמצאה');
    }

    if (payload.projectId) {
      await this.validateProjectId(payload.projectId);
    }

    const row = await this.prisma.task.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.projectId !== undefined ? { project_id: payload.projectId } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      },
      select: TASK_LIST_SELECT,
    });
    return toListItem(row as TaskRow);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('משימה לא נמצאה');
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        status: 'closed',
        deleted_at: new Date(),
      },
    });
  }

  private async validateProjectId(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, is_active: true, deleted_at: true },
    });
    if (!project || project.deleted_at || !project.is_active) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        details: [
          {
            field: 'projectId',
            rule: 'VAL-25',
            message: VAL_MESSAGES['VAL-25'],
          },
        ],
      });
    }
  }

  private buildWhere(query: TasksListQuery): Prisma.TaskWhereInput {
    const and: Prisma.TaskWhereInput[] = [];

    if (query.q) {
      and.push({ name: { contains: query.q, mode: 'insensitive' } });
    }

    if (query.projectId) {
      and.push({ project_id: query.projectId });
    }

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.includeDeleted) {
      and.push({
        OR: [{ deleted_at: null }, { deleted_at: { not: null } }],
      });
    }

    const where: Prisma.TaskWhereInput = and.length > 0 ? { AND: and } : {};

    if (query.includeDeleted) {
      where.deleted_at = {};
    }

    return where;
  }
}
