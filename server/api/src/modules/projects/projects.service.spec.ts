import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const MANAGER_ID = '990e8400-e29b-41d4-a716-446655440000';

const PROJECT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Project Alpha',
  client_id: '660e8400-e29b-41d4-a716-446655440000',
  is_active: true,
  lead_manager_id: null as string | null,
  start_date: null as Date | null,
  end_date: null as Date | null,
  description: null as string | null,
  deleted_at: null,
  client: { name: 'Acme Corp' },
  lead_manager: null as { full_name: string } | null,
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
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: MANAGER_ID, deleted_at: null }),
    },
    task: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    timeEntry: {
      findFirst: vi.fn(),
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
      expect(result.data[0]).toMatchObject({
        name: 'Project Alpha',
        clientName: 'Acme Corp',
        isDeleted: false,
        leadManagerId: null,
        leadManagerName: null,
        startDate: null,
        endDate: null,
        description: null,
      });
    });

    it('maps lead manager, ISO dates, and description onto the list item', async () => {
      prisma.project.findMany.mockResolvedValue([
        {
          ...PROJECT,
          lead_manager_id: MANAGER_ID,
          lead_manager: { full_name: 'Dana Manager' },
          start_date: new Date('2026-01-01T00:00:00.000Z'),
          end_date: new Date('2026-06-30T00:00:00.000Z'),
          description: 'Alpha description',
        },
      ]);
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: false,
      });
      expect(result.data[0]).toMatchObject({
        leadManagerId: MANAGER_ID,
        leadManagerName: 'Dana Manager',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        description: 'Alpha description',
      });
    });

    it('sorts by clientName using related client.name', async () => {
      await service.list({
        page: 1,
        limit: 20,
        sort: 'clientName',
        order: 'desc',
        includeDeleted: false,
      });
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { client: { name: 'desc' } },
        }),
      );
    });

    it('maps isDeleted from deleted_at when includeDeleted is true', async () => {
      prisma.project.findMany.mockResolvedValue([
        { ...PROJECT, deleted_at: new Date('2026-08-01T00:00:00.000Z') },
      ]);
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: true,
      });
      expect(result.data[0]?.isDeleted).toBe(true);
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

    it('persists lead manager, dates, and description as snake_case columns', async () => {
      await service.create({
        name: 'Project Alpha',
        clientId: PROJECT.client_id,
        leadManagerId: MANAGER_ID,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        description: 'Alpha description',
      });
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lead_manager_id: MANAGER_ID,
            start_date: new Date('2026-01-01T00:00:00.000Z'),
            end_date: new Date('2026-06-30T00:00:00.000Z'),
            description: 'Alpha description',
          }),
        }),
      );
    });

    it('defaults omitted KAN-120 fields to null columns', async () => {
      await service.create({ name: 'Project Alpha', clientId: PROJECT.client_id });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lead_manager_id: null,
            start_date: null,
            end_date: null,
            description: null,
          }),
        }),
      );
    });

    it('validates leadManagerId exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ name: 'P', clientId: PROJECT.client_id, leadManagerId: MANAGER_ID }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('validates leadManagerId is not deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: MANAGER_ID, deleted_at: new Date() });
      await expect(
        service.create({ name: 'P', clientId: PROJECT.client_id, leadManagerId: MANAGER_ID }),
      ).rejects.toThrow(UnprocessableEntityException);
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

    it('validates clientId if updated to a different client', async () => {
      const newClientId = '770e8400-e29b-41d4-a716-446655440000';
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.update(PROJECT.id, { clientId: newClientId })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('does not re-validate clientId when it matches the stored client', async () => {
      await service.update(PROJECT.id, { name: 'Same Client', clientId: PROJECT.client_id });
      expect(prisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('updates lead manager, dates, and description', async () => {
      await service.update(PROJECT.id, {
        leadManagerId: MANAGER_ID,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        description: 'Updated description',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: MANAGER_ID } }),
      );
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lead_manager_id: MANAGER_ID,
            start_date: new Date('2026-01-01T00:00:00.000Z'),
            end_date: new Date('2026-06-30T00:00:00.000Z'),
            description: 'Updated description',
          }),
        }),
      );
    });

    it('clears lead manager, dates, and description with null', async () => {
      await service.update(PROJECT.id, {
        leadManagerId: null,
        startDate: null,
        endDate: null,
        description: null,
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lead_manager_id: null,
            start_date: null,
            end_date: null,
            description: null,
          }),
        }),
      );
    });

    it('validates leadManagerId if updated to a different user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update(PROJECT.id, { leadManagerId: MANAGER_ID })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('does not re-validate leadManagerId when it matches the stored manager', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...PROJECT, lead_manager_id: MANAGER_ID });
      await service.update(PROJECT.id, { leadManagerId: MANAGER_ID });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('does not write tasks when deactivating', async () => {
      await service.update(PROJECT.id, { isActive: false });
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
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
      expect(prisma.task.update).not.toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('still resolves the project name for a TimeEntry when the read includes deleted relations', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({
        task: { project: { name: PROJECT.name, deleted_at: new Date() } },
      });
      await service.softDelete(PROJECT.id);
      const name = await service.historicalProjectNameForTimeEntry('te-1');
      expect(name).toBe('Project Alpha');
      expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'te-1', deleted_at: {} }),
        }),
      );
    });

    it('still resolves the project name after deactivate', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({
        task: { project: { name: PROJECT.name, deleted_at: null } },
      });
      await service.update(PROJECT.id, { isActive: false });
      await expect(service.historicalProjectNameForTimeEntry('te-1')).resolves.toBe(
        'Project Alpha',
      );
    });

    it('throws 404 if not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(PROJECT.id)).rejects.toThrow(NotFoundException);
    });
  });
});
