import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  VAL_MESSAGES,
  type ProjectListItem,
  type ProjectsListQuery,
  type CreateProjectBody,
  type UpdateProjectBody,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const SORT_COLUMN: Record<
  ProjectsListQuery['sort'],
  keyof Prisma.ProjectOrderByWithRelationInput
> = {
  name: 'name',
  isActive: 'is_active',
};

const PROJECT_LIST_SELECT = {
  id: true,
  name: true,
  client_id: true,
  is_active: true,
  client: { select: { name: true } },
} as const;

type ProjectRow = {
  id: string;
  name: string;
  client_id: string;
  is_active: boolean;
  client: { name: string };
};

function toListItem(row: ProjectRow): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    clientName: row.client.name,
    isActive: row.is_active,
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ProjectsListQuery,
  ): Promise<{ data: ProjectListItem[]; meta: { page: number; limit: number; total: number } }> {
    const where = this.buildWhere(query);
    const orderBy = {
      [SORT_COLUMN[query.sort]]: query.order,
    } as Prisma.ProjectOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: PROJECT_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: (rows as ProjectRow[]).map(toListItem),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: string): Promise<ProjectListItem> {
    const row = await this.prisma.project.findUnique({
      where: { id },
      select: PROJECT_LIST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('פרויקט לא נמצא');
    }
    return toListItem(row as ProjectRow);
  }

  async create(input: CreateProjectBody): Promise<ProjectListItem> {
    await this.validateClientId(input.clientId);

    const row = await this.prisma.project.create({
      data: {
        name: input.name,
        client_id: input.clientId,
      },
      select: PROJECT_LIST_SELECT,
    });
    return toListItem(row as ProjectRow);
  }

  async update(id: string, payload: UpdateProjectBody): Promise<ProjectListItem> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('פרויקט לא נמצא');
    }

    if (payload.clientId) {
      await this.validateClientId(payload.clientId);
    }

    const row = await this.prisma.project.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.clientId !== undefined ? { client_id: payload.clientId } : {}),
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
      },
      select: PROJECT_LIST_SELECT,
    });
    return toListItem(row as ProjectRow);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('פרויקט לא נמצא');
    }

    await this.prisma.project.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  private async validateClientId(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, is_active: true, deleted_at: true },
    });
    if (!client || client.deleted_at || !client.is_active) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        details: [
          {
            field: 'clientId',
            rule: 'VAL-23',
            message: VAL_MESSAGES['VAL-23'],
          },
        ],
      });
    }
  }

  private buildWhere(query: ProjectsListQuery): Prisma.ProjectWhereInput {
    const and: Prisma.ProjectWhereInput[] = [];

    if (query.q) {
      and.push({ name: { contains: query.q, mode: 'insensitive' } });
    }

    if (query.clientId) {
      and.push({ client_id: query.clientId });
    }

    if (query.isActive !== undefined) {
      and.push({ is_active: query.isActive });
    }

    if (query.includeDeleted) {
      and.push({
        OR: [{ deleted_at: null }, { deleted_at: { not: null } }],
      });
    }

    const where: Prisma.ProjectWhereInput = and.length > 0 ? { AND: and } : {};

    if (query.includeDeleted) {
      where.deleted_at = {};
    }

    return where;
  }
}
