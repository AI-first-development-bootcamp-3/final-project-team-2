import { z } from 'zod';
import { AbsenceType, HalfDayPeriod } from '../enums.js';
import { LOCAL_DATE_PATTERN } from '../day-status/local-date.js';

/**
 * Query for reading absences.
 *
 * `userId` is admin-only: an employee's absences are always scoped to the
 * authenticated user, whatever the query says (§7.1). The month filter matches
 * any absence overlapping the month, so a range crossing a boundary appears in
 * both months it touches.
 */
export const AbsencesListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  userId: z.string().uuid().optional(),
});

export type AbsencesListQuery = z.infer<typeof AbsencesListQuerySchema>;

/**
 * One absence as the API returns it.
 *
 * `startDate` / `endDate` / `isHalfDay` are deliberately the exact shape
 * `DayStatusAbsence` reads, so these rows feed `computeDayStatus` unchanged.
 *
 * The Monthly View epic (KAN-80, PR #72) declares a narrower `MonthAbsenceSchema`
 * for the same rows. Whichever lands second should make one derive from the
 * other rather than leaving two hand-maintained copies of the bounds — that PR
 * is still open, so this cannot import it yet.
 */
export const AbsenceListItemSchema = z.object({
  id: z.string().uuid(),
  type: AbsenceType,
  /** `YYYY-MM-DD` local date, inclusive. */
  startDate: z.string().regex(LOCAL_DATE_PATTERN),
  /** `YYYY-MM-DD` local date, inclusive. */
  endDate: z.string().regex(LOCAL_DATE_PATTERN),
  /**
   * A half day covers only part of the date, so it reduces the day's expected
   * hours instead of claiming it (§8.5).
   */
  isHalfDay: z.boolean(),
  halfDayPeriod: HalfDayPeriod.nullable(),
  notes: z.string().nullable(),
  /**
   * The report this row came from. Rows sharing one are one absence to the
   * employee, and an edit or delete addressed to any of them applies to all.
   */
  groupId: z.string().uuid().nullable(),
  /**
   * A sick or military absence with no attachment (VAL-44). Never true for
   * vacation or other, which expect no document. The Month Close epic's
   * pre-lock warning list reads this.
   */
  missingDocument: z.boolean(),
});

export type AbsenceListItem = z.infer<typeof AbsenceListItemSchema>;

export const AbsencesListSuccessSchema = z.object({ data: z.array(AbsenceListItemSchema) });
export type AbsencesListSuccess = z.infer<typeof AbsencesListSuccessSchema>;

/**
 * A create returns every row it produced, since one reported range can become
 * several — the client needs all of them to render what it just saved.
 */
export const AbsenceCreateSuccessSchema = z.object({ data: z.array(AbsenceListItemSchema) });
export type AbsenceCreateSuccess = z.infer<typeof AbsenceCreateSuccessSchema>;

export const AbsenceGetSuccessSchema = z.object({ data: AbsenceListItemSchema });
export type AbsenceGetSuccess = z.infer<typeof AbsenceGetSuccessSchema>;
