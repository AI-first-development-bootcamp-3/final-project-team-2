import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const PROJECT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Project Alpha',
  client_id: '660e8400-e29b-41d4-a716-446655440000',
  is_active: true,
  deleted_at: null,
  client: { name: 'Acme Corp' },
};

function createPrisma() {
  return {
    project: {
      findMany: vi.fn().mockResolvedValue([PROJECT]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(PROJECT),
      create: vi.fn().mockResolvedValue(PROJECT),
      update: vi.fn().mockResolvedValue(PROJECT),
    },
    client: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: PROJECT.client_id, is_active: true, deleted_at: null }),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new ProjectsService(prisma as never);
}

describe('ProjectsService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = createPrisma();
    service = createService(prisma);
  });

  describe('list', () => {
    it('returns paginated projects with client name', async () => {
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: false,
      });
      expect(result.data[0]).toMatchObject({ name: 'Project Alpha', clientName: 'Acme Corp' });
    });

    it('filters by clientId, q search, and isActive', async () => {
      await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        clientId: PROJECT.client_id,
        q: 'Alpha',
        isActive: true,
        includeDeleted: true,
      });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { client_id: PROJECT.client_id },
              { name: { contains: 'Alpha', mode: 'insensitive' } },
              { is_active: true },
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns project details when found', async () => {
      const result = await service.findOne(PROJECT.id);
      expect(result).toMatchObject({ id: PROJECT.id, name: 'Project Alpha' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne(PROJECT.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates project when client exists and active', async () => {
      const result = await service.create({ name: 'Project Alpha', clientId: PROJECT.client_id });
      expect(result).toMatchObject({ id: PROJECT.id });
    });

    it('validates clientId exists', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.create({ name: 'P', clientId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('validates clientId is active', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: 'x', is_active: false, deleted_at: null });
      await expect(service.create({ name: 'P', clientId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('validates clientId is not deleted', async () => {
      prisma.client.findUnique.mockResolvedValue({
        id: 'x',
        is_active: true,
        deleted_at: new Date(),
      });
      await expect(service.create({ name: 'P', clientId: 'x' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('update', () => {
    it('updates project name and status', async () => {
      const result = await service.update(PROJECT.id, { name: 'New Name', isActive: false });
      expect(result).toMatchObject({ id: PROJECT.id });
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Name', is_active: false }),
        }),
      );
    });

    it('validates clientId if updated', async () => {
      const newClientId = '770e8400-e29b-41d4-a716-446655440000';
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.update(PROJECT.id, { clientId: newClientId })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws NotFoundException when project missing or deleted', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.update(PROJECT.id, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('does not cascade to tasks', async () => {
      await service.softDelete(PROJECT.id);
      expect(prisma.project.update).toHaveBeenCalledTimes(1);
    });

    it('throws 404 if not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(PROJECT.id)).rejects.toThrow(NotFoundException);
    });
  });
});
