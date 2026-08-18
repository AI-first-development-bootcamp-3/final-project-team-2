import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  VAL_MESSAGES,
  type ClientListItem,
  type ClientsListQuery,
  type CreateClientBody,
  type UpdateClientBody,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const SORT_COLUMN: Record<ClientsListQuery['sort'], keyof Prisma.ClientOrderByWithRelationInput> = {
  name: 'name',
  isActive: 'is_active',
};

const CLIENT_LIST_SELECT = {
  id: true,
  name: true,
  contact_info: true,
  is_active: true,
} as const;

function toListItem(row: {
  id: string;
  name: string;
  contact_info: string | null;
  is_active: boolean;
}): ClientListItem {
  return {
    id: row.id,
    name: row.name,
    contactInfo: row.contact_info,
    isActive: row.is_active,
  };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ClientsListQuery,
  ): Promise<{ data: ClientListItem[]; meta: { page: number; limit: number; total: number } }> {
    const where = this.buildWhere(query);
    const orderBy = {
      [SORT_COLUMN[query.sort]]: query.order,
    } as Prisma.ClientOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: CLIENT_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: rows.map(toListItem),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: string): Promise<ClientListItem> {
    const row = await this.prisma.client.findUnique({
      where: { id },
      select: CLIENT_LIST_SELECT,
    });
    if (!row || row.is_active === undefined) {
      throw new NotFoundException('לקוח לא נמצא');
    }
    return toListItem(row);
  }

  async create(input: CreateClientBody): Promise<ClientListItem> {
    await this.checkNameUniqueness(input.name);

    try {
      const row = await this.prisma.client.create({
        data: {
          name: input.name,
          contact_info: input.contactInfo ?? null,
        },
        select: CLIENT_LIST_SELECT,
      });
      return toListItem(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.throwNameConflict();
      }
      throw error;
    }
  }

  async update(id: string, payload: UpdateClientBody): Promise<ClientListItem> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('לקוח לא נמצא');
    }

    if (payload.name && payload.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.checkNameUniqueness(payload.name, id);
    }

    const row = await this.prisma.client.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.contactInfo !== undefined ? { contact_info: payload.contactInfo } : {}),
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
      },
      select: CLIENT_LIST_SELECT,
    });
    return toListItem(row);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('לקוח לא נמצא');
    }

    await this.prisma.client.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  private async checkNameUniqueness(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.client.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deleted_at: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      this.throwNameConflict();
    }
  }

  private throwNameConflict(): never {
    throw new ConflictException({
      statusCode: 409,
      message: 'Conflict',
      error: 'Conflict',
      details: [
        {
          field: 'name',
          rule: 'VAL-21',
          message: VAL_MESSAGES['VAL-21'],
        },
      ],
    });
  }

  private buildWhere(query: ClientsListQuery): Prisma.ClientWhereInput {
    const and: Prisma.ClientWhereInput[] = [];

    if (query.q) {
      and.push({
        name: { contains: query.q, mode: 'insensitive' },
      });
    }

    if (query.isActive !== undefined) {
      and.push({ is_active: query.isActive });
    }

    if (query.includeDeleted) {
      and.push({
        OR: [{ deleted_at: null }, { deleted_at: { not: null } }],
      });
    }

    const where: Prisma.ClientWhereInput = and.length > 0 ? { AND: and } : {};

    if (query.includeDeleted) {
      where.deleted_at = {};
    }

    return where;
  }
}
