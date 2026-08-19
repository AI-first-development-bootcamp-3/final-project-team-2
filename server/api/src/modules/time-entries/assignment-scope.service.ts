import { ForbiddenException, Injectable } from '@nestjs/common';
import { valDetail, type ValCode } from '@abra/contracts';
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

/**
 * The task as the write paths need to judge it.
 *
 * `deleted_at` is selected explicitly at every level because the soft-delete
 * extension only injects its filter into the *top-level* `where` of the model
 * being queried — nested relations come back regardless — and `TaskAssignment`
 * is not a soft-delete model at all, so the row survives every kind of
 * cleanup above it.
 */
const TASK_AVAILABILITY_SELECT = {
  task: {
    select: {
      status: true,
      deleted_at: true,
      project: {
        select: {
          is_active: true,
          deleted_at: true,
          report_type: true,
          client: { select: { is_active: true, deleted_at: true } },
        },
      },
    },
  },
} as const;

type TaskAvailabilityRow = {
  task: {
    status: 'open' | 'closed';
    deleted_at: Date | null;
    project: {
      is_active: boolean;
      deleted_at: Date | null;
      report_type: 'TOTAL_HOURS' | 'CLOCK_IN_OUT';
      client: { is_active: boolean; deleted_at: Date | null };
    };
  };
};

function isReportable(row: TaskAvailabilityRow): boolean {
  const { task } = row;
  const { project } = task;

  return (
    task.status === 'open' &&
    task.deleted_at === null &&
    project.is_active &&
    project.deleted_at === null &&
    // Manual entries belong to hour-total projects; punch-clock projects are
    // reported through the timer, which the Punch Clock epic owns.
    project.report_type === 'TOTAL_HOURS' &&
    project.client.is_active &&
    project.client.deleted_at === null
  );
}

function forbidden(rule: Extract<ValCode, 'VAL-33' | 'VAL-33A'>): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    message: 'Forbidden',
    error: 'Forbidden',
    details: [valDetail('taskId', rule)],
  });
}

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
      throw forbidden('VAL-33');
    }
  }

  /**
   * The full check a new report of hours must pass — the server-side twin of
   * what `GET /me/assignments` shows the picker.
   *
   * An assignment row alone is not enough. `TaskAssignment` is never soft
   * deleted and nothing prunes it, so closing a task, removing it,
   * deactivating its project or client, or switching the project to
   * punch-clock all leave the row behind. Checking only its existence let a
   * direct API call write entries the picker could never have produced, which
   * is exactly what design D9 says must not be possible: the server is the
   * only authority on validation, and an out-of-date client must not be able
   * to write bad data.
   *
   * Deliberately *not* applied to an edit that keeps the same task — see
   * `TimeEntriesService.update`. Availability governs where new hours may be
   * reported, not whether an entry already on the books can be corrected.
   */
  async assertTaskAvailableForReporting(userId: string, taskId: string): Promise<void> {
    const assignment = await this.prisma.taskAssignment.findUnique({
      where: { user_id_task_id: { user_id: userId, task_id: taskId } },
      select: TASK_AVAILABILITY_SELECT,
    });

    if (assignment === null) {
      throw forbidden('VAL-33');
    }

    // Assigned, but the work is no longer open for reporting — a different
    // problem, and one VAL-33's wording would describe wrongly.
    if (!isReportable(assignment as TaskAvailabilityRow)) {
      throw forbidden('VAL-33A');
    }
  }
}
