import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UserListItem, UsersListQuery } from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const SORT_COLUMN: Record<UsersListQuery['sort'], keyof Prisma.UserOrderByWithRelationInput> = {
  fullName: 'full_name',
  email: 'email',
  role: 'role',
  isActive: 'is_active',
};

const USER_LIST_SELECT = {
  id: true,
  full_name: true,
  email: true,
  role: true,
  is_active: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: UsersListQuery,
  ): Promise<{ data: UserListItem[]; meta: { page: number; limit: number; total: number } }> {
    const where = this.buildWhere(query);
    const orderBy = {
      [SORT_COLUMN[query.sort]]: query.order,
    } as Prisma.UserOrderByWithRelationInput;

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        isActive: row.is_active,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  }

  private buildWhere(query: UsersListQuery): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];

    if (query.q) {
      and.push({
        OR: [
          { full_name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.role) {
      and.push({ role: query.role });
    }

    if (query.isActive !== undefined) {
      and.push({ is_active: query.isActive });
    }

    if (query.includeDeleted) {
      and.push({
        OR: [{ deleted_at: null }, { deleted_at: { not: null } }],
      });
    }

    const where: Prisma.UserWhereInput = and.length > 0 ? { AND: and } : {};

    if (query.includeDeleted) {
      // Middleware only skips its deleted_at=null filter when this key is set.
      where.deleted_at = {};
    }

    return where;
  }
}
