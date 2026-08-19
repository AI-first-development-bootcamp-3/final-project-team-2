import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TasksService } from './tasks.service';

const TASK = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Task One',
  project_id: '660e8400-e29b-41d4-a716-446655440000',
  status: 'open' as const,
  description: 'First task description',
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

  describe('list', () => {
    it('returns paginated tasks with project and client names', async () => {
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: false,
      });
      expect(result.data[0]).toMatchObject({
        name: 'Task One',
        projectName: 'Project Alpha',
        clientName: 'Acme Corp',
      });
    });

    it('filters by projectId, status, q, and includeDeleted', async () => {
      await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        projectId: TASK.project_id,
        status: 'open',
        q: 'One',
        includeDeleted: true,
      });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { project_id: TASK.project_id },
              { status: 'open' },
              { name: { contains: 'One', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('bypasses the soft-delete filter when includeDeleted is true', async () => {
      await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: true,
      });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: {} }),
        }),
      );
      expect(prisma.task.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: {} }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns task details when found', async () => {
      const result = await service.findOne(TASK.id);
      expect(result).toMatchObject({ id: TASK.id, name: 'Task One' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.findOne(TASK.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates task when project is active', async () => {
      const result = await service.create({
        name: 'Task One',
        projectId: TASK.project_id,
        description: 'First task description',
      });
      expect(result).toMatchObject({ id: TASK.id });
    });

    it('validates projectId exists', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create({ name: 'T', projectId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('validates projectId is active', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'x', is_active: false, deleted_at: null });
      await expect(service.create({ name: 'T', projectId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('validates projectId is not deleted', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'x',
        is_active: true,
        deleted_at: new Date(),
      });
      await expect(service.create({ name: 'T', projectId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('update', () => {
    it('updates task name, status, and description', async () => {
      const result = await service.update(TASK.id, {
        name: 'Updated Task',
        status: 'closed',
        description: 'Updated desc',
      });
      expect(result).toMatchObject({ id: TASK.id });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated Task',
            status: 'closed',
            description: 'Updated desc',
          }),
        }),
      );
    });

    it('validates projectId if updated', async () => {
      const newProjectId = '770e8400-e29b-41d4-a716-446655440000';
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.update(TASK.id, { projectId: newProjectId })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws NotFoundException when task missing or deleted', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update(TASK.id, { name: 'X' })).rejects.toThrow(NotFoundException);
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
