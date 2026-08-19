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

const GROUPED_TASK = {
  id: ASSIGNMENT.task_id,
  name: 'Task One',
  project: { name: 'Project Alpha', client: { name: 'Acme Corp' } },
  task_assignments: [
    {
      id: ASSIGNMENT.id,
      user_id: ASSIGNMENT.user_id,
      user: { full_name: 'Alice Cohen', email: 'alice@abra.co' },
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      user_id: '00000000-0000-0000-0000-000000000013',
      user: { full_name: 'Bob Levi', email: 'bob@abra.co' },
    },
  ],
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
      findMany: vi.fn().mockResolvedValue([GROUPED_TASK]),
      count: vi.fn().mockResolvedValue(1),
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

  describe('listGroupedByTask', () => {
    it('returns one row per task with the full employees array', async () => {
      const result = await service.listGroupedByTask({ page: 1, limit: 20, order: 'asc' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        taskId: GROUPED_TASK.id,
        taskName: 'Task One',
        projectName: 'Project Alpha',
        clientName: 'Acme Corp',
        employees: [
          {
            assignmentId: ASSIGNMENT.id,
            userId: ASSIGNMENT.user_id,
            userFullName: 'Alice Cohen',
            userEmail: 'alice@abra.co',
          },
          {
            assignmentId: 'a0000000-0000-0000-0000-000000000002',
            userId: '00000000-0000-0000-0000-000000000013',
            userFullName: 'Bob Levi',
            userEmail: 'bob@abra.co',
          },
        ],
      });
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('paginates and sorts at the task level', async () => {
      await service.listGroupedByTask({ page: 3, limit: 10, order: 'desc' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'desc' },
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.task.count).toHaveBeenCalled();
    });

    it('matches a task when ANY of its employees matches q (name or email)', async () => {
      await service.listGroupedByTask({ page: 1, limit: 20, order: 'asc', q: 'Alice' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
            task_assignments: {
              some: {
                AND: [
                  {
                    OR: [
                      { user: { full_name: { contains: 'Alice', mode: 'insensitive' } } },
                      { user: { email: { contains: 'Alice', mode: 'insensitive' } } },
                    ],
                  },
                ],
              },
            },
          }),
        }),
      );
    });

    it('applies userId and taskId filters at the task level', async () => {
      await service.listGroupedByTask({
        page: 1,
        limit: 20,
        order: 'asc',
        userId: ASSIGNMENT.user_id,
        taskId: ASSIGNMENT.task_id,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ASSIGNMENT.task_id,
            task_assignments: { some: { AND: [{ user_id: ASSIGNMENT.user_id }] } },
          }),
        }),
      );
    });
  });

  describe('list with search', () => {
    it('searches by user name', async () => {
      await service.list({ page: 1, limit: 20, order: 'asc', q: 'Alice' });
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
