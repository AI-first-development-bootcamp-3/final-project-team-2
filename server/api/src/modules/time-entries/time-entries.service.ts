import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompletedTimeEntrySchema,
  OVERLAP_CANDIDATE_WINDOW_DAYS,
  VAL_MESSAGES,
  findOverlap,
  toYearMonth,
  zodIssuesToDetails,
  type CreateTimeEntryBody,
  type TimeEntriesListQuery,
  type TimeEntryListItem,
  type UpdateTimeEntryBody,
  type ValCode,
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

const OVERLAP_WINDOW_MS = OVERLAP_CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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
    await this.assignmentScope.assertTaskAvailableForReporting(userId, body.taskId);
    await this.assertNoOverlap(userId, body.startAt, body.endAt);

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

  /**
   * Applies a partial edit to one of the caller's own entries.
   *
   * The patch is merged onto the stored row and the *result* is validated
   * against the same rules a create must satisfy, so changing one field cannot
   * leave the entry in a state a create would have rejected — a patch that
   * moves only `startAt` past the stored `endAt` still fails VAL-31.
   */
  async update(
    userId: string,
    entryId: string,
    body: UpdateTimeEntryBody,
  ): Promise<TimeEntryListItem> {
    const existing = await this.findOwnEntryOrFail(userId, entryId);
    this.assertNotRunning(existing.end_at);
    const existingDate = toDateString(existing.date);

    // The month the entry currently sits in must be open before it can be
    // touched at all (§7.1).
    const from = toYearMonth(existingDate);
    await this.monthLock.assertMonthNotLocked(from.year, from.month);

    const merged = CompletedTimeEntrySchema.safeParse({
      taskId: body.taskId ?? existing.task_id,
      date: body.date ?? existingDate,
      startAt: body.startAt ?? existing.start_at.toISOString(),
      endAt: body.endAt ?? existing.end_at?.toISOString(),
      location: body.location ?? existing.location,
      description: body.description === undefined ? existing.description : body.description,
    });

    if (!merged.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: zodIssuesToDetails(merged.error.issues).map((detail) => ({
          ...detail,
          message:
            detail.rule in VAL_MESSAGES ? VAL_MESSAGES[detail.rule as ValCode] : detail.message,
        })),
      });
    }

    // An edit that moves the entry into a different month needs *that* month
    // open too, so a locked month cannot be filled by relocating entries into it.
    const to = toYearMonth(merged.data.date);
    if (to.year !== from.year || to.month !== from.month) {
      await this.monthLock.assertMonthNotLocked(to.year, to.month);
    }

    // Moving the entry onto a *different* task is a new report of hours against
    // that task, so it faces the full availability check. Keeping the same task
    // is only a correction, and is held to plain assignment: an entry logged
    // while the task was open must stay fixable — and deletable — after the
    // task is closed or its client deactivated, or a typo would be frozen into
    // the month with no way out (§8.3, the same reason the read path keeps
    // showing it).
    if (merged.data.taskId === existing.task_id) {
      await this.assignmentScope.assertUserAssignedToTask(userId, merged.data.taskId);
    } else {
      await this.assignmentScope.assertTaskAvailableForReporting(userId, merged.data.taskId);
    }

    await this.assertNoOverlap(userId, merged.data.startAt, merged.data.endAt, entryId);

    const row = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        task_id: merged.data.taskId,
        date: toDateColumnValue(merged.data.date),
        start_at: new Date(merged.data.startAt),
        end_at: new Date(merged.data.endAt),
        location: merged.data.location,
        description: merged.data.description ?? null,
      },
      select: TIME_ENTRY_SELECT,
    });

    return toListItem(row as TimeEntryRow);
  }

  /**
   * Removes one of the caller's own entries while its month is open.
   *
   * The delete is soft: `SOFT_DELETE_MODELS` already covers TimeEntry, so the
   * Prisma extension rewrites this into a `deleted_at` stamp and every
   * subsequent read, day total, and overlap check skips the row (§8.3). No
   * delete logic of our own is involved.
   */
  async remove(userId: string, entryId: string): Promise<void> {
    const existing = await this.findOwnEntryOrFail(userId, entryId);
    this.assertNotRunning(existing.end_at);

    const { year, month } = toYearMonth(toDateString(existing.date));
    await this.monthLock.assertMonthNotLocked(year, month);

    await this.prisma.timeEntry.delete({ where: { id: entryId } });
  }

  /**
   * Refuses to edit or delete an entry that is still running.
   *
   * A running entry has no end time, so the merged-entry rules could only
   * report VAL-31 against a field the caller never sent — misleading when the
   * real answer is that this is not where running entries are handled. They are
   * completed or cancelled through the timer (§8.6, VAL-37), which the Punch
   * Clock epic owns; this epic never creates one.
   */
  private assertNotRunning(endAt: Date | null): void {
    if (endAt !== null) {
      return;
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Conflict',
      error: 'Conflict',
      details: [
        {
          field: 'endAt',
          rule: 'VAL-RUNNING-ENTRY',
          message: VAL_MESSAGES['VAL-RUNNING-ENTRY'],
        },
      ],
    });
  }

  /**
   * Loads an entry that belongs to the caller.
   *
   * An entry owned by somebody else is reported as missing rather than
   * forbidden: answering "forbidden" would confirm the id exists, letting a
   * caller probe for other employees' entries.
   */
  private async findOwnEntryOrFail(userId: string, entryId: string) {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, user_id: userId },
      select: {
        id: true,
        date: true,
        start_at: true,
        end_at: true,
        location: true,
        description: true,
        task_id: true,
      },
    });

    if (existing === null) {
      throw new NotFoundException('דיווח השעות לא נמצא');
    }

    return existing;
  }

  /**
   * Rejects an entry that would occupy time the employee has already reported
   * (VAL-32).
   *
   * The query filters on an existing entry's *start*, so a night shift begun
   * the previous evening would slip past a naive same-day filter; the window is
   * widened by a day on each side to keep it in the candidate set. The
   * comparison itself is the pure helper from contracts, which treats touching
   * boundaries as non-overlapping.
   *
   * Soft-deleted rows are filtered by the Prisma extension and other employees'
   * entries by `user_id`, so neither can produce a false collision.
   *
   * @param excludeEntryId the entry being edited, which must not collide with
   * itself.
   */
  private async assertNoOverlap(
    userId: string,
    startAt: string,
    endAt: string,
    excludeEntryId?: string,
  ): Promise<void> {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const candidates = await this.prisma.timeEntry.findMany({
      where: {
        user_id: userId,
        ...(excludeEntryId === undefined ? {} : { id: { not: excludeEntryId } }),
        start_at: {
          gte: new Date(start.getTime() - OVERLAP_WINDOW_MS),
          lte: new Date(end.getTime() + OVERLAP_WINDOW_MS),
        },
      },
      select: { id: true, start_at: true, end_at: true },
    });

    const clash = findOverlap(
      { startAt: start, endAt: end },
      candidates.map((candidate) => ({
        id: candidate.id,
        startAt: candidate.start_at,
        endAt: candidate.end_at,
      })),
    );

    if (clash !== undefined) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Conflict',
        error: 'Conflict',
        details: [
          {
            field: 'startAt',
            rule: 'VAL-32',
            message: VAL_MESSAGES['VAL-32'],
          },
        ],
      });
    }
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
