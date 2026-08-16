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

function toCamelCase(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type ModelDelegate = {
  update: (args: Record<string, unknown>) => Promise<unknown>;
  updateMany: (args: Record<string, unknown>) => Promise<unknown>;
};

type BaseClient = Record<string, ModelDelegate>;

/**
 * Applies soft-delete semantics to a Prisma query operation.
 * Exported for unit testing.
 *
 * For delete/deleteMany on soft-delete models the base PrismaClient's model
 * delegate is used directly (update/updateMany) so the operation type is
 * converted correctly. Calling query() here would still issue a DELETE
 * because $extends query handlers cannot change the operation type.
 */
export async function applySoftDeleteMiddleware(params: {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
  client: BaseClient;
}): Promise<unknown> {
  const { model, operation, args, query, client } = params;

  const isSoftDeleteModel = (SOFT_DELETE_MODELS as string[]).includes(model);
  if (!isSoftDeleteModel) {
    return query(args);
  }

  // Use base client (not extended) to call update/updateMany directly.
  // This avoids recursive middleware and is intentional — the base client
  // bypasses the extension chain, which prevents infinite loops.
  // Intercept delete → soft delete via model delegate (not query())
  if (operation === 'delete') {
    const modelName = toCamelCase(model);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return client[modelName]!.update({ where: args['where'], data: { deleted_at: new Date() } });
  }

  if (operation === 'deleteMany') {
    const modelName = toCamelCase(model);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return client[modelName]!.updateMany({
      where: args['where'],
      data: { deleted_at: new Date() },
    });
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

    const baseClient = this as unknown as BaseClient;
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return applySoftDeleteMiddleware({ model, operation, args, query, client: baseClient });
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
