import { ForbiddenException, Injectable } from '@nestjs/common';
import { VAL_MESSAGES } from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Assignment scoping (VAL-33, §8.2).
 *
 * An employee may only report against tasks they are assigned to. Checked on
 * create and re-checked on update, so an edit cannot move an entry onto work
 * the employee was never given.
 *
 * This is the server-side counterpart to the picker's client-side filtering:
 * the picker hides unassigned work, this makes hiding it unnecessary for
 * correctness.
 */
@Injectable()
export class AssignmentScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async isUserAssignedToTask(userId: string, taskId: string): Promise<boolean> {
    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { user_id_task_id: { user_id: userId, task_id: taskId } },
      select: { id: true },
    });

    return assignment !== null;
  }

  /** Throws 403 with VAL-33 when the employee holds no assignment for the task. */
  async assertUserAssignedToTask(userId: string, taskId: string): Promise<void> {
    if (!(await this.isUserAssignedToTask(userId, taskId))) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Forbidden',
        error: 'Forbidden',
        details: [
          {
            field: 'taskId',
            rule: 'VAL-33',
            message: VAL_MESSAGES['VAL-33'],
          },
        ],
      });
    }
  }
}
