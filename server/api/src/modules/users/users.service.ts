import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  VAL_MESSAGES,
  type CreateUserBody,
  type DeactivateUserResponse,
  type ResetPasswordPayload,
  type RestoreUserResponse,
  type UpdateUserPayload,
  type UserListItem,
  type UsersListQuery,
} from '@abra/contracts';
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

const BCRYPT_SALT_ROUNDS = 10;

function toListItem(row: {
  id: string;
  full_name: string;
  email: string;
  role: UserListItem['role'];
  is_active: boolean;
}): UserListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
  };
}

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
      data: rows.map(toListItem),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
      },
    };
  }

  async create(input: CreateUserBody): Promise<UserListItem> {
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      this.throwEmailConflict();
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    try {
      const row = await this.prisma.user.create({
        data: {
          full_name: fullName,
          email,
          password_hash: passwordHash,
          role: input.role,
        },
        select: USER_LIST_SELECT,
      });
      return toListItem(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.throwEmailConflict();
      }
      throw error;
    }
  }

  private throwEmailConflict(): never {
    throw new ConflictException({
      statusCode: 409,
      message: 'Conflict',
      error: 'Conflict',
      details: [
        {
          field: 'email',
          rule: 'VAL-11',
          message: VAL_MESSAGES['VAL-11'],
        },
      ],
    });
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deleted_at) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    if (payload.email && payload.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = await this.prisma.user.findFirst({
        where: {
          email: { equals: payload.email, mode: 'insensitive' },
          id: { not: id },
          deleted_at: null,
        },
      });
      if (emailConflict) {
        throw new ConflictException('כתובת האימייל כבר קיימת במערכת');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(payload.fullName ? { full_name: payload.fullName } : {}),
        ...(payload.email ? { email: payload.email } : {}),
        ...(payload.role ? { role: payload.role } : {}),
      },
      select: USER_LIST_SELECT,
    });

    return {
      id: updated.id,
      fullName: updated.full_name,
      email: updated.email,
      role: updated.role,
      isActive: updated.is_active,
    };
  }

  async resetPassword(id: string, payload: ResetPasswordPayload): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deleted_at) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    await this.prisma.user.update({
      where: { id },
      data: {
        password_hash: hashedPassword,
        token_version: { increment: 1 },
      },
    });

    return { message: 'הסיסמה שונתה בהצלחה' };
  }

  async deactivateUser(id: string): Promise<DeactivateUserResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    const now = new Date();
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        is_active: false,
        deleted_at: now,
        token_version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      isActive: false,
      deletedAt: updated.deleted_at ? updated.deleted_at.toISOString() : now.toISOString(),
    };
  }

  async restoreUser(id: string): Promise<RestoreUserResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        is_active: true,
        deleted_at: null,
      },
    });

    return {
      id: updated.id,
      isActive: true,
      deletedAt: null,
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
