import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AssignmentScopeService } from './assignment-scope.service';

const USER_ID = '00000000-0000-0000-0000-000000000011';
const TASK_ID = '00000000-0000-0000-0000-000000000012';

function createPrisma(assignment: { id: string } | null) {
  return {
    taskAssignment: {
      findUnique: vi.fn().mockResolvedValue(assignment),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new AssignmentScopeService(prisma as never);
}

describe('AssignmentScopeService', () => {
  describe('an assigned task', () => {
    let prisma: ReturnType<typeof createPrisma>;
    let service: AssignmentScopeService;

    beforeEach(() => {
      prisma = createPrisma({ id: 'assignment-1' });
      service = createService(prisma);
    });

    it('reports the employee as assigned', async () => {
      await expect(service.isUserAssignedToTask(USER_ID, TASK_ID)).resolves.toBe(true);
    });

    it('permits the write', async () => {
      await expect(service.assertUserAssignedToTask(USER_ID, TASK_ID)).resolves.toBeUndefined();
    });

    it('looks the assignment up by the user and task pair', async () => {
      await service.isUserAssignedToTask(USER_ID, TASK_ID);
      expect(prisma.taskAssignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id_task_id: { user_id: USER_ID, task_id: TASK_ID } },
        }),
      );
    });
  });

  describe('an unassigned task', () => {
    let service: AssignmentScopeService;

    beforeEach(() => {
      service = createService(createPrisma(null));
    });

    it('reports the employee as not assigned', async () => {
      await expect(service.isUserAssignedToTask(USER_ID, TASK_ID)).resolves.toBe(false);
    });

    it('refuses the write with 403', async () => {
      await expect(service.assertUserAssignedToTask(USER_ID, TASK_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('names VAL-33 against the task field', async () => {
      await expect(service.assertUserAssignedToTask(USER_ID, TASK_ID)).rejects.toMatchObject({
        response: {
          statusCode: 403,
          details: [expect.objectContaining({ field: 'taskId', rule: 'VAL-33' })],
        },
      });
    });
  });

  /**
   * The assignment row outlives everything above it — it is not soft-deleted
   * and nothing prunes it — so each of these is a live path for writing hours
   * against work the picker would never offer.
   */
  describe('reporting availability', () => {
    function availableTask() {
      return {
        task: {
          status: 'open',
          deleted_at: null as Date | null,
          project: {
            is_active: true,
            deleted_at: null as Date | null,
            report_type: 'TOTAL_HOURS',
            client: { is_active: true, deleted_at: null as Date | null },
          },
        },
      };
    }

    function serviceFor(row: unknown) {
      return createService(createPrisma(row as never));
    }

    it('permits an open task under an active project and client', async () => {
      await expect(
        serviceFor(availableTask()).assertTaskAvailableForReporting(USER_ID, TASK_ID),
      ).resolves.toBeUndefined();
    });

    it('still reports a missing assignment as VAL-33', async () => {
      await expect(
        serviceFor(null).assertTaskAvailableForReporting(USER_ID, TASK_ID),
      ).rejects.toMatchObject({
        response: { details: [expect.objectContaining({ rule: 'VAL-33' })] },
      });
    });

    type TaskRow = ReturnType<typeof availableTask>;

    it.each<[string, (row: TaskRow) => void]>([
      ['a closed task', (row) => (row.task.status = 'closed')],
      ['a soft-deleted task', (row) => (row.task.deleted_at = new Date())],
      ['an inactive project', (row) => (row.task.project.is_active = false)],
      ['a soft-deleted project', (row) => (row.task.project.deleted_at = new Date())],
      ['a punch-clock project', (row) => (row.task.project.report_type = 'CLOCK_IN_OUT')],
      ['an inactive client', (row) => (row.task.project.client.is_active = false)],
      ['a soft-deleted client', (row) => (row.task.project.client.deleted_at = new Date())],
    ])('refuses %s with VAL-33A even though the assignment survives', async (_label, mutate) => {
      const row = availableTask();
      mutate(row);

      await expect(
        serviceFor(row).assertTaskAvailableForReporting(USER_ID, TASK_ID),
      ).rejects.toMatchObject({
        response: {
          statusCode: 403,
          details: [expect.objectContaining({ field: 'taskId', rule: 'VAL-33A' })],
        },
      });
    });

    it('reads the catalogue state through the assignment in one query', async () => {
      const prisma = createPrisma(availableTask() as never);
      await createService(prisma).assertTaskAvailableForReporting(USER_ID, TASK_ID);

      expect(prisma.taskAssignment.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.taskAssignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id_task_id: { user_id: USER_ID, task_id: TASK_ID } },
        }),
      );
    });
  });
});
