import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

const ACME = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Corp',
  contact_info: 'info@acme.com',
  is_active: true,
  deleted_at: null,
};

function createPrisma() {
  return {
    client: {
      findMany: vi.fn().mockResolvedValue([ACME]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(ACME),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(ACME),
      update: vi.fn().mockResolvedValue(ACME),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new ClientsService(prisma as never);
}

describe('ClientsService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: ClientsService;

  beforeEach(() => {
    prisma = createPrisma();
    service = createService(prisma);
  });

  describe('list', () => {
    it('returns paginated clients', async () => {
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: false,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: ACME.id,
        name: 'Acme Corp',
        contactInfo: 'info@acme.com',
        isActive: true,
        isDeleted: false,
      });
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('maps isDeleted from deleted_at when includeDeleted is true', async () => {
      prisma.client.findMany.mockResolvedValue([{ ...ACME, deleted_at: new Date() }]);
      const result = await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        includeDeleted: true,
      });
      expect(result.data[0]?.isDeleted).toBe(true);
    });

    it('passes search query to prisma', async () => {
      await service.list({
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
        q: 'acme',
        includeDeleted: false,
      });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ name: { contains: 'acme', mode: 'insensitive' } }]),
          }),
        }),
      );
    });

    it('includes deleted when flag is set', async () => {
      await service.list({ page: 1, limit: 20, sort: 'name', order: 'asc', includeDeleted: true });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: {} }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a client', async () => {
      const result = await service.create({ name: 'New Client' });
      expect(result.name).toBe('Acme Corp');
      expect(prisma.client.create).toHaveBeenCalled();
    });

    it('throws 409 on duplicate name', async () => {
      prisma.client.findFirst.mockResolvedValue(ACME);
      await expect(service.create({ name: 'Acme Corp' })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates a client', async () => {
      const result = await service.update(ACME.id, { name: 'Updated' });
      expect(result).toBeDefined();
      expect(prisma.client.update).toHaveBeenCalled();
    });

    it('re-checks uniqueness on name change', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'other', name: 'Updated' });
      await expect(service.update(ACME.id, { name: 'Updated' })).rejects.toThrow(ConflictException);
    });

    it('throws 404 if not found', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.update(ACME.id, { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('sets deleted_at', async () => {
      await service.softDelete(ACME.id);
      expect(prisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ACME.id },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws 404 if not found', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      await expect(service.softDelete(ACME.id)).rejects.toThrow(NotFoundException);
    });

    it('does not cascade to projects', async () => {
      await service.softDelete(ACME.id);
      expect(prisma.client.update).toHaveBeenCalledTimes(1);
    });
  });
});
