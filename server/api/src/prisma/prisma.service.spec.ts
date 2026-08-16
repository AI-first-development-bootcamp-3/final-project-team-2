import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService, applySoftDeleteMiddleware, SOFT_DELETE_MODELS } from './prisma.service';

describe('PrismaService', () => {
  it('is defined and extends PrismaClient', async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = module.get(PrismaService);
    expect(service).toBeDefined();
    expect(service).toHaveProperty('$connect');
    expect(service).toHaveProperty('user');
    expect(service).toHaveProperty('client');
    expect(service).toHaveProperty('timeEntry');
  });

  it('has soft-delete models listed', async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = module.get(PrismaService);
    expect(service.softDeleteModels).toEqual(
      expect.arrayContaining(['User', 'Client', 'Project', 'Task', 'TimeEntry', 'Absence']),
    );
    expect(service.softDeleteModels).toHaveLength(6);
  });
});

describe('applySoftDeleteMiddleware', () => {
  const makeQuery = () => vi.fn().mockResolvedValue('result');

  const makeClient = () => ({
    user: {
      update: vi.fn().mockResolvedValue('updated'),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      update: vi.fn().mockResolvedValue('updated'),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  });

  it('passes through non-soft-delete models unchanged', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { id: '123' } };
    await applySoftDeleteMiddleware({
      model: 'AuditLog',
      operation: 'findMany',
      args,
      query,
      client,
    });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('converts delete to soft delete for soft-delete models', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { id: '123' } };
    await applySoftDeleteMiddleware({ model: 'User', operation: 'delete', args, query, client });
    expect(query).not.toHaveBeenCalled();
    expect(client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: args.where,
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  it('converts deleteMany to soft delete (ignores caller data)', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { role: 'employee' } };
    await applySoftDeleteMiddleware({
      model: 'User',
      operation: 'deleteMany',
      args,
      query,
      client,
    });
    expect(query).not.toHaveBeenCalled();
    expect(client.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: args.where,
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  it('converts deleteMany to soft delete without existing data', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { role: 'employee' } };
    await applySoftDeleteMiddleware({
      model: 'User',
      operation: 'deleteMany',
      args,
      query,
      client,
    });
    expect(query).not.toHaveBeenCalled();
    expect(client.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: args.where,
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  it('adds deleted_at: null filter on findMany for soft-delete models', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { role: 'employee' } };
    await applySoftDeleteMiddleware({ model: 'User', operation: 'findMany', args, query, client });
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deleted_at: null }) }),
    );
  });

  it('adds deleted_at: null when no where clause exists', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = {};
    await applySoftDeleteMiddleware({
      model: 'Client',
      operation: 'findMany',
      args,
      query,
      client,
    });
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ where: { deleted_at: null } }));
  });

  it('does not override explicit deleted_at filter in reads', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { where: { deleted_at: { not: null } } };
    await applySoftDeleteMiddleware({ model: 'User', operation: 'findMany', args, query, client });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('passes through non-read/delete operations unchanged', async () => {
    const query = makeQuery();
    const client = makeClient();
    const args = { data: { full_name: 'Test' } };
    await applySoftDeleteMiddleware({ model: 'User', operation: 'update', args, query, client });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('covers all 6 soft-delete models', () => {
    expect(SOFT_DELETE_MODELS).toHaveLength(6);
    expect(SOFT_DELETE_MODELS).toContain('User');
    expect(SOFT_DELETE_MODELS).toContain('Absence');
  });
});
