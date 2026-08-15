import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export const SOFT_DELETE_MODELS: Prisma.ModelName[] = [
  'User',
  'Client',
  'Project',
  'Task',
  'TimeEntry',
  'Absence',
];

export const SOFT_DELETE_READ_ACTIONS = [
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
] as const;

/**
 * Applies soft-delete semantics to a Prisma query operation.
 * Exported for unit testing.
 */
export async function applySoftDeleteMiddleware(params: {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}): Promise<unknown> {
  const { model, operation, args, query } = params;

  const isSoftDeleteModel = (SOFT_DELETE_MODELS as string[]).includes(model);
  if (!isSoftDeleteModel) {
    return query(args);
  }

  // Intercept delete → soft delete
  if (operation === 'delete') {
    return query({ ...args, data: { deleted_at: new Date() } });
  }

  if (operation === 'deleteMany') {
    const existingData =
      typeof args['data'] === 'object' && args['data'] !== null
        ? (args['data'] as Record<string, unknown>)
        : {};
    return query({ ...args, data: { ...existingData, deleted_at: new Date() } });
  }

  // Intercept reads → filter out soft-deleted
  if ((SOFT_DELETE_READ_ACTIONS as readonly string[]).includes(operation)) {
    const existingWhere =
      typeof args['where'] === 'object' && args['where'] !== null
        ? (args['where'] as Record<string, unknown>)
        : {};
    // Only add filter if deleted_at is not explicitly set in the query
    if (existingWhere['deleted_at'] === undefined) {
      return query({ ...args, where: { ...existingWhere, deleted_at: null } });
    }
  }

  return query(args);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  readonly softDeleteModels: Prisma.ModelName[] = SOFT_DELETE_MODELS;

  constructor() {
    super();

    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return applySoftDeleteMiddleware({ model, operation, args, query });
          },
        },
      },
    });

    // Propagate softDeleteModels to the extended client instance
    (extended as unknown as { softDeleteModels: Prisma.ModelName[] }).softDeleteModels =
      SOFT_DELETE_MODELS;

    // Return the extended client so all Prisma model accessors are available
    return extended as unknown as this;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected');
  }
}
