import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TasksService } from './tasks.service';

const TASK = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Task One',
  project_id: '660e8400-e29b-41d4-a716-446655440000',
  status: 'open' as const,
  description: null,
  deleted_at: null,
  project: { name: 'Project Alpha', client: { name: 'Acme Corp' } },
};

function createPrisma() {
  return {
    task: {
      findMany: vi.fn().mockResolvedValue([TASK]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(TASK),
      create: vi.fn().mockResolvedValue(TASK),
      update: vi.fn().mockResolvedValue(TASK),
    },
    project: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: TASK.project_id, is_active: true, deleted_at: null }),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new TasksService(prisma as never);
}

describe('TasksService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: TasksService;

  beforeEach(() => {
    prisma = createPrisma();
    service = createService(prisma);
  });

  describe('create', () => {
    it('validates projectId is active', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'x', is_active: false, deleted_at: null });
      await expect(service.create({ name: 'T', projectId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('softDelete', () => {
    it('sets both status=closed AND deleted_at', async () => {
      await service.softDelete(TASK.id);
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'closed',
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('does not remove assignments on delete', async () => {
      await service.softDelete(TASK.id);
      expect(prisma.task.update).toHaveBeenCalledTimes(1);
    });

    it('throws 404 if not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(TASK.id)).rejects.toThrow(NotFoundException);
    });
  });
});
