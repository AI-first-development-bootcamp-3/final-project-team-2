import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MergedAbsenceSchema,
  VAL_MESSAGES,
  requiresDocument,
  splitIntoWorkingRuns,
  toYearMonth,
  zodIssuesToDetails,
  type AbsenceListItem,
  type AbsenceType,
  type AbsencesListQuery,
  type CreateAbsenceBody,
  type DateRange,
  type HalfDayPeriod,
  type UpdateAbsenceBody,
  type ValCode,
} from '@abra/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AbsenceLockService, type AbsenceOperation } from './absence-lock.service';

const ABSENCE_SELECT = {
  id: true,
  type: true,
  start_date: true,
  end_date: true,
  is_half_day: true,
  half_day_period: true,
  notes: true,
  group_id: true,
  // The soft-delete extension keys off the top-level model, so it does not
  // reach a nested relation read — the filter here is doing real work, not
  // belt-and-braces. Without it a deleted note would still satisfy VAL-44.
  attachments: { where: { deleted_at: null }, select: { id: true } },
} as const;

type AbsenceRow = {
  id: string;
  type: AbsenceType;
  start_date: Date;
  end_date: Date;
  is_half_day: boolean;
  half_day_period: HalfDayPeriod | null;
  notes: string | null;
  group_id: string | null;
  attachments: { id: string }[];
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

function toDateColumnValue(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function toListItem(row: AbsenceRow): AbsenceListItem {
  return {
    id: row.id,
    type: row.type,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    isHalfDay: row.is_half_day,
    halfDayPeriod: row.half_day_period,
    notes: row.notes,
    groupId: row.group_id,
    // VAL-44 — flagged, never rejected: the document usually arrives later (§7.1).
    missingDocument: requiresDocument(row.type) && row.attachments.length === 0,
  };
}

/** Every distinct year/month a set of ranges touches. */
function monthsTouched(ranges: readonly DateRange[]): { year: number; month: number }[] {
  const seen = new Map<string, { year: number; month: number }>();

  for (const range of ranges) {
    for (const date of [range.startDate, range.endDate]) {
      const { year, month } = toYearMonth(date);
      seen.set(`${year}-${month}`, { year, month });
    }
  }

  return [...seen.values()];
}

function toRange(row: AbsenceRow): DateRange {
  return { startDate: toDateString(row.start_date), endDate: toDateString(row.end_date) };
}

@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly absenceLock: AbsenceLockService,
  ) {}

  /**
   * Reports an absence for the given employee.
   *
   * One reported range becomes one row per contiguous run of working days
   * (VAL-43), all sharing a group id so the employee can later edit or delete
   * their vacation rather than its fragments. Ownership comes from the
   * authenticated user, never from the body.
   */
  async create(userId: string, body: CreateAbsenceBody): Promise<AbsenceListItem[]> {
    const runs = splitIntoWorkingRuns(body.startDate, body.endDate);

    if (runs.length === 0) {
      // The contract already rejects weekend bounds, so this is only reachable
      // if the weekend rule and the splitter ever disagree. Fail loudly rather
      // than storing an absence that covers nothing.
      this.rejectValidation('startDate', 'VAL-43');
    }

    // Every month the absence lands in must accept it, checked before any write
    // so a range reaching into a locked month is refused whole rather than
    // stored in half (§7.3).
    await this.assertMonthsWritable('create', body.type, runs);
    await this.assertNoOverlap(userId, runs);

    const groupId = randomUUID();

    const created = await this.prisma.$transaction(
      runs.map((run) =>
        this.prisma.absence.create({
          data: {
            user_id: userId,
            type: body.type,
            start_date: toDateColumnValue(run.startDate),
            end_date: toDateColumnValue(run.endDate),
            is_half_day: body.isHalfDay,
            half_day_period: body.halfDayPeriod ?? null,
            notes: body.notes ?? null,
            group_id: groupId,
          },
          select: ABSENCE_SELECT,
        }),
      ),
    );

    return (created as AbsenceRow[]).map(toListItem);
  }

  /**
   * Absences for one employee, optionally narrowed to a month.
   *
   * An employee only ever sees their own; an admin reads any single employee's
   * by passing a user id. Soft-deleted rows are excluded by the Prisma
   * extension, so no filter is needed here.
   */
  async list(targetUserId: string, query: AbsencesListQuery): Promise<AbsenceListItem[]> {
    const rows = await this.prisma.absence.findMany({
      where: {
        user_id: targetUserId,
        ...this.buildMonthFilter(query),
      },
      select: ABSENCE_SELECT,
      orderBy: [{ start_date: 'asc' }],
    });

    return (rows as AbsenceRow[]).map(toListItem);
  }

  async findOne(userId: string, absenceId: string): Promise<AbsenceListItem> {
    return toListItem(await this.findOwnAbsenceOrFail(userId, absenceId));
  }

  /**
   * Applies a partial edit to one of the caller's own absences.
   *
   * The patch is merged onto the stored group and the *result* is validated
   * against the same rules a create must satisfy, so changing one field cannot
   * leave the absence in a state a create would have rejected. The edit then
   * replaces the whole group: re-splitting is the only way to keep the stored
   * rows true once the range moves.
   */
  async update(
    userId: string,
    absenceId: string,
    body: UpdateAbsenceBody,
  ): Promise<AbsenceListItem[]> {
    const existing = await this.findOwnAbsenceOrFail(userId, absenceId);
    const group = await this.loadGroup(userId, existing);
    const first = group[0] as AbsenceRow;
    const last = group[group.length - 1] as AbsenceRow;

    // The months the absence currently occupies must be open before it can be
    // touched at all, whatever the edit does.
    await this.assertMonthsWritable('update', existing.type, group.map(toRange));

    const merged = MergedAbsenceSchema.safeParse({
      type: body.type ?? existing.type,
      // The group's outer bounds are what the employee originally reported, so
      // an edit that moves only the end date extends from that start rather
      // than from whichever fragment they happened to address.
      startDate: body.startDate ?? toDateString(first.start_date),
      endDate: body.endDate ?? toDateString(last.end_date),
      isHalfDay: body.isHalfDay ?? existing.is_half_day,
      halfDayPeriod:
        body.halfDayPeriod === undefined ? existing.half_day_period : body.halfDayPeriod,
      notes: body.notes === undefined ? existing.notes : body.notes,
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

    const runs = splitIntoWorkingRuns(merged.data.startDate, merged.data.endDate);
    if (runs.length === 0) {
      this.rejectValidation('startDate', 'VAL-43');
    }

    // An edit that moves the absence into a different month needs *that* month
    // open too, so a locked month cannot be filled by relocating absences into it.
    await this.assertMonthsWritable('update', merged.data.type, runs);

    const groupId = existing.group_id ?? randomUUID();
    const replacedIds = group.map((row) => row.id);
    await this.assertNoOverlap(userId, runs, replacedIds);

    const rows = await this.prisma.$transaction(async (tx) => {
      // Stamp `deleted_at` directly rather than calling `delete`: the
      // soft-delete extension performs its rewrite against the base client,
      // which would escape this transaction and could leave the group
      // half-replaced if a later create failed.
      await tx.absence.updateMany({
        where: { id: { in: replacedIds } },
        data: { deleted_at: new Date() },
      });

      const created: unknown[] = [];
      for (const run of runs) {
        created.push(
          await tx.absence.create({
            data: {
              user_id: userId,
              type: merged.data.type,
              start_date: toDateColumnValue(run.startDate),
              end_date: toDateColumnValue(run.endDate),
              is_half_day: merged.data.isHalfDay,
              half_day_period: merged.data.halfDayPeriod ?? null,
              notes: merged.data.notes ?? null,
              group_id: groupId,
            },
            select: ABSENCE_SELECT,
          }),
        );
      }
      return created;
    });

    return (rows as AbsenceRow[]).map(toListItem);
  }

  /**
   * Removes one of the caller's own absences, and every row reported with it.
   *
   * The delete is soft: the rows are retained and excluded from every
   * subsequent read, day status, and overlap check (§8.3).
   */
  async remove(userId: string, absenceId: string): Promise<void> {
    const existing = await this.findOwnAbsenceOrFail(userId, absenceId);
    const group = await this.loadGroup(userId, existing);

    await this.assertMonthsWritable('delete', existing.type, group.map(toRange));

    await this.prisma.absence.updateMany({
      where: { id: { in: group.map((row) => row.id) } },
      data: { deleted_at: new Date() },
    });
  }

  /**
   * Every row reported alongside this one, in date order.
   *
   * A row with no group id predates the grouping column and is a group of one.
   */
  private async loadGroup(userId: string, existing: AbsenceRow): Promise<AbsenceRow[]> {
    if (existing.group_id === null) {
      return [existing];
    }

    const rows = await this.prisma.absence.findMany({
      where: { user_id: userId, group_id: existing.group_id },
      select: ABSENCE_SELECT,
      orderBy: [{ start_date: 'asc' }],
    });

    // A group is never empty — the row we already hold belongs to it — but a
    // read that somehow returns nothing must not produce an out-of-bounds
    // access downstream.
    return rows.length === 0 ? [existing] : (rows as AbsenceRow[]);
  }

  private async assertMonthsWritable(
    operation: AbsenceOperation,
    type: AbsenceType,
    ranges: readonly DateRange[],
  ): Promise<void> {
    for (const { year, month } of monthsTouched(ranges)) {
      await this.absenceLock.assertWritable(operation, type, year, month);
    }
  }

  /**
   * Rejects an absence covering a day the employee is already absent on.
   *
   * The comparison is on stored calendar dates, so a plain range-overlap
   * predicate is exact and needs no candidate window of the kind time entries
   * require. Soft-deleted rows are filtered by the Prisma extension and other
   * employees' rows by `user_id`, so neither can produce a false collision.
   *
   * @param excludeIds rows being replaced by this write, which must not collide
   * with themselves.
   */
  private async assertNoOverlap(
    userId: string,
    runs: readonly DateRange[],
    excludeIds: readonly string[] = [],
  ): Promise<void> {
    for (const run of runs) {
      const clash = await this.prisma.absence.findFirst({
        where: {
          user_id: userId,
          ...(excludeIds.length === 0 ? {} : { id: { notIn: [...excludeIds] } }),
          // Two inclusive ranges overlap when each starts on or before the
          // other ends.
          start_date: { lte: toDateColumnValue(run.endDate) },
          end_date: { gte: toDateColumnValue(run.startDate) },
        },
        select: { id: true },
      });

      if (clash !== null) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Conflict',
          error: 'Conflict',
          details: [
            {
              field: 'startDate',
              rule: 'VAL-ABSENCE-OVERLAP',
              message: VAL_MESSAGES['VAL-ABSENCE-OVERLAP'],
            },
          ],
        });
      }
    }
  }

  /**
   * Loads an absence that belongs to the caller.
   *
   * Somebody else's absence is reported as missing rather than forbidden:
   * answering "forbidden" would confirm the id exists, letting a caller probe
   * for other employees' records.
   */
  private async findOwnAbsenceOrFail(userId: string, absenceId: string): Promise<AbsenceRow> {
    const existing = await this.prisma.absence.findFirst({
      where: { id: absenceId, user_id: userId },
      select: ABSENCE_SELECT,
    });

    if (existing === null) {
      throw new NotFoundException(ABSENCE_NOT_FOUND);
    }

    return existing as AbsenceRow;
  }

  private rejectValidation(field: string, rule: ValCode): never {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field, rule, message: VAL_MESSAGES[rule] }],
    });
  }

  /** Absences overlapping the requested month, if one was requested. */
  private buildMonthFilter(query: AbsencesListQuery): Record<string, unknown> {
    if (query.year === undefined || query.month === undefined) {
      return {};
    }

    const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1));
    // Day 0 of the next month is the last day of this one.
    const monthEnd = new Date(Date.UTC(query.year, query.month, 0));

    return {
      start_date: { lte: monthEnd },
      end_date: { gte: monthStart },
    };
  }
}

/** Kept out of the class so the controller and its tests can assert on it. */
export const ABSENCE_NOT_FOUND = 'ההיעדרות לא נמצאה';
