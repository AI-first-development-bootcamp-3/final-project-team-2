import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AssignmentsService } from './assignments.service';

const ASSIGNMENT = {
  id: 'a0000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000011',
  task_id: '00000000-0000-0000-0000-000000000012',
  user: { full_name: 'Alice Cohen', email: 'alice@abra.co' },
  task: { name: 'Task One', project: { name: 'Project Alpha', client: { name: 'Acme Corp' } } },
};

function createPrisma() {
  return {
    taskAssignment: {
      findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(ASSIGNMENT),
      create: vi.fn().mockResolvedValue(ASSIGNMENT),
      delete: vi.fn().mockResolvedValue(ASSIGNMENT),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: ASSIGNMENT.user_id, deleted_at: null }),
    },
    task: {
      findUnique: vi.fn().mockResolvedValue({ id: ASSIGNMENT.task_id, deleted_at: null }),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new AssignmentsService(prisma as never);
}

describe('AssignmentsService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssignmentsService;

  beforeEach(() => {
    prisma = createPrisma();
    service = createService(prisma);
  });

  describe('create', () => {
    it('validates userId and taskId exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ userId: ASSIGNMENT.user_id, taskId: ASSIGNMENT.task_id }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 409 on duplicate assignment (P2002)', async () => {
      prisma.taskAssignment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['user_id', 'task_id'] },
        }),
      );
      await expect(
        service.create({ userId: ASSIGNMENT.user_id, taskId: ASSIGNMENT.task_id }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('hardDelete', () => {
    it('deletes the assignment', async () => {
      await service.hardDelete(ASSIGNMENT.id);
      expect(prisma.taskAssignment.delete).toHaveBeenCalledWith({ where: { id: ASSIGNMENT.id } });
    });

    it('throws 404 if not found', async () => {
      prisma.taskAssignment.findUnique.mockResolvedValue(null);
      await expect(service.hardDelete(ASSIGNMENT.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list with search', () => {
    it('searches by user name', async () => {
      await service.list({ page: 1, limit: 20, q: 'Alice' });
      expect(prisma.taskAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { user: { full_name: { contains: 'Alice', mode: 'insensitive' } } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });
});
