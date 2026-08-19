/**
 * The inclusive `YYYY-MM-DD` bounds of one calendar month.
 *
 * Entries persist their Asia/Jerusalem start day in the `date` column (VAL-38
 * is enforced on every write), so selecting a month is a plain range over that
 * column — no timezone conversion happens at read time.
 */
export interface MonthDateRange {
  from: string;
  to: string;
}

export function monthDateRange(year: number, month: number): MonthDateRange {
  // Day 0 of the following month is the last day of this one; month is
  // 1-based here and 0-based in Date.UTC, so `month` already points there.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  return {
    from: `${prefix}-01`,
    to: `${prefix}-${String(lastDay).padStart(2, '0')}`,
  };
}
