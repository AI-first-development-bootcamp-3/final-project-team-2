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
});
