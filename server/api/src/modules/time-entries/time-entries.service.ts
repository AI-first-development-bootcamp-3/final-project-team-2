import { Injectable } from '@nestjs/common';
import {
  toYearMonth,
  type CreateTimeEntryBody,
  type TimeEntriesListQuery,
  type TimeEntryListItem,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentScopeService } from './assignment-scope.service';
import { MonthLockService } from './month-lock.service';

/**
 * Everything needed to render an entry without a second request.
 *
 * Task, project, and client names are denormalised on the way out so a
 * historical entry still displays after its task is closed or its client
 * deactivated (§8.3) — the picker hides those, the history must not.
 */
const TIME_ENTRY_SELECT = {
  id: true,
  date: true,
  start_at: true,
  end_at: true,
  location: true,
  description: true,
  task_id: true,
  task: {
    select: {
      id: true,
      name: true,
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type TimeEntryRow = {
  id: string;
  date: Date;
  start_at: Date;
  end_at: Date | null;
  location: 'office' | 'client_site' | 'home' | null;
  description: string | null;
  task_id: string | null;
  task: {
    id: string;
    name: string;
    project: { id: string; name: string; client: { id: string; name: string } };
  } | null;
};

/**
 * A `@db.Date` column comes back as UTC midnight on that calendar day, so the
 * ISO date part is exactly the stored day. Deliberately not routed through the
 * Asia/Jerusalem helper: the value is already a local calendar date, and
 * re-interpreting it as an instant would risk shifting it.
 */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` query value into the instant the date column stores. */
function toDateColumnValue(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function toListItem(row: TimeEntryRow): TimeEntryListItem {
  return {
    id: row.id,
    date: toDateString(row.date),
    startAt: row.start_at.toISOString(),
    endAt: row.end_at?.toISOString() ?? null,
    location: row.location,
    description: row.description,
    taskId: row.task_id,
    taskName: row.task?.name ?? null,
    projectId: row.task?.project.id ?? null,
    projectName: row.task?.project.name ?? null,
    clientId: row.task?.project.client.id ?? null,
    clientName: row.task?.project.client.name ?? null,
  };
}

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentScope: AssignmentScopeService,
    private readonly monthLock: MonthLockService,
  ) {}

  /**
   * Creates an entry for the given employee.
   *
   * Ownership is taken from the authenticated user, never from the body, so a
   * caller cannot report hours against somebody else.
   */
  async create(userId: string, body: CreateTimeEntryBody): Promise<TimeEntryListItem> {
    const { year, month } = toYearMonth(body.date);

    // Order matters only for which message the employee sees first; both are
    // required before any write reaches the database.
    await this.monthLock.assertMonthNotLocked(year, month);
    await this.assignmentScope.assertUserAssignedToTask(userId, body.taskId);

    const row = await this.prisma.timeEntry.create({
      data: {
        user_id: userId,
        task_id: body.taskId,
        date: toDateColumnValue(body.date),
        start_at: new Date(body.startAt),
        end_at: new Date(body.endAt),
        location: body.location,
        description: body.description ?? null,
      },
      select: TIME_ENTRY_SELECT,
    });

    return toListItem(row as TimeEntryRow);
  }

  /**
   * The caller's own entries for a single day or an inclusive range.
   *
   * Soft-deleted rows are excluded by the Prisma extension, so no filter is
   * needed here.
   */
  async list(userId: string, query: TimeEntriesListQuery): Promise<TimeEntryListItem[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: {
        user_id: userId,
        date: this.buildDateFilter(query),
      },
      select: TIME_ENTRY_SELECT,
      orderBy: [{ date: 'asc' }, { start_at: 'asc' }],
    });

    return (rows as TimeEntryRow[]).map(toListItem);
  }

  private buildDateFilter(query: TimeEntriesListQuery): Date | { gte: Date; lte: Date } {
    if (query.date !== undefined) {
      return toDateColumnValue(query.date);
    }

    // The schema guarantees both ends are present whenever either one is.
    return {
      gte: toDateColumnValue(query.from as string),
      lte: toDateColumnValue(query.to as string),
    };
  }
}
