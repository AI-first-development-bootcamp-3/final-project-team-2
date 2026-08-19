import { describe, expect, it } from 'vitest';
import { hasWorkingDay, isWeekend, splitIntoWorkingRuns } from './split.js';

// Anchor dates, so the weekday of every fixture is checkable by hand:
//   2026-08-16 Sun · 17 Mon · 18 Tue · 19 Wed · 20 Thu · 21 Fri · 22 Sat
//   2026-08-23 Sun · 24 Mon · 25 Tue · 26 Wed · 27 Thu · 28 Fri · 29 Sat
//   2026-08-30 Sun

describe('isWeekend', () => {
  it('treats Friday and Saturday as the weekend', () => {
    expect(isWeekend('2026-08-21')).toBe(true);
    expect(isWeekend('2026-08-22')).toBe(true);
  });

  it('treats Sunday through Thursday as working days', () => {
    for (const date of ['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20']) {
      expect(isWeekend(date)).toBe(false);
    }
  });

  it('rejects a malformed date', () => {
    expect(() => isWeekend('16/08/2026')).toThrow(RangeError);
  });

  it('rejects a date that does not exist', () => {
    expect(() => isWeekend('2026-02-30')).toThrow(RangeError);
  });
});

describe('splitIntoWorkingRuns', () => {
  it('keeps a range inside one working week as a single run', () => {
    expect(splitIntoWorkingRuns('2026-08-16', '2026-08-20')).toEqual([
      { startDate: '2026-08-16', endDate: '2026-08-20' },
    ]);
  });

  it('splits a range spanning one weekend into two runs', () => {
    expect(splitIntoWorkingRuns('2026-08-20', '2026-08-23')).toEqual([
      { startDate: '2026-08-20', endDate: '2026-08-20' },
      { startDate: '2026-08-23', endDate: '2026-08-23' },
    ]);
  });

  it('splits a range spanning two weekends into three runs', () => {
    expect(splitIntoWorkingRuns('2026-08-20', '2026-08-30')).toEqual([
      { startDate: '2026-08-20', endDate: '2026-08-20' },
      { startDate: '2026-08-23', endDate: '2026-08-27' },
      { startDate: '2026-08-30', endDate: '2026-08-30' },
    ]);
  });

  it('returns one single-day run for a single working day', () => {
    expect(splitIntoWorkingRuns('2026-08-17', '2026-08-17')).toEqual([
      { startDate: '2026-08-17', endDate: '2026-08-17' },
    ]);
  });

  it('drops leading weekend days', () => {
    expect(splitIntoWorkingRuns('2026-08-21', '2026-08-24')).toEqual([
      { startDate: '2026-08-23', endDate: '2026-08-24' },
    ]);
  });

  it('drops trailing weekend days', () => {
    expect(splitIntoWorkingRuns('2026-08-19', '2026-08-22')).toEqual([
      { startDate: '2026-08-19', endDate: '2026-08-20' },
    ]);
  });

  it('returns nothing for a weekend-only range', () => {
    expect(splitIntoWorkingRuns('2026-08-21', '2026-08-22')).toEqual([]);
  });

  it('returns nothing for a single weekend day', () => {
    expect(splitIntoWorkingRuns('2026-08-21', '2026-08-21')).toEqual([]);
  });

  it('returns nothing when the range runs backwards', () => {
    expect(splitIntoWorkingRuns('2026-08-20', '2026-08-16')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    // 2026-08-30 Sun · 31 Mon · 09-01 Tue
    expect(splitIntoWorkingRuns('2026-08-30', '2026-09-01')).toEqual([
      { startDate: '2026-08-30', endDate: '2026-09-01' },
    ]);
  });

  it('crosses a year boundary', () => {
    // 2026-12-31 Thu · 2027-01-01 Fri · 02 Sat · 03 Sun
    expect(splitIntoWorkingRuns('2026-12-31', '2027-01-03')).toEqual([
      { startDate: '2026-12-31', endDate: '2026-12-31' },
      { startDate: '2027-01-03', endDate: '2027-01-03' },
    ]);
  });

  it('spans a leap day', () => {
    // 2028-02-27 Sun · 28 Mon · 29 Tue (leap) · 03-01 Wed
    expect(splitIntoWorkingRuns('2028-02-27', '2028-03-01')).toEqual([
      { startDate: '2028-02-27', endDate: '2028-03-01' },
    ]);
  });

  it('is unaffected by the Israeli DST transitions', () => {
    // DST starts 2026-03-27 (Fri) and ends 2026-10-25 (Sun). Pinning dates to
    // UTC midnight means neither shifts a day.
    expect(splitIntoWorkingRuns('2026-03-26', '2026-03-29')).toEqual([
      { startDate: '2026-03-26', endDate: '2026-03-26' },
      { startDate: '2026-03-29', endDate: '2026-03-29' },
    ]);
    expect(splitIntoWorkingRuns('2026-10-25', '2026-10-26')).toEqual([
      { startDate: '2026-10-25', endDate: '2026-10-26' },
    ]);
  });
});

describe('hasWorkingDay', () => {
  it('is true when the range contains a working day', () => {
    expect(hasWorkingDay('2026-08-20', '2026-08-23')).toBe(true);
  });

  it('is false for a weekend-only range', () => {
    expect(hasWorkingDay('2026-08-21', '2026-08-22')).toBe(false);
  });
});
