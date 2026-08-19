import { describe, it, expect } from 'vitest';
import {
  toLocalDate,
  isSameLocalDate,
  isCalendarDate,
  toYearMonth,
  APP_TIME_ZONE,
} from './local-date.js';

describe('toLocalDate', () => {
  it('formats an instant as a YYYY-MM-DD Asia/Jerusalem date', () => {
    expect(toLocalDate(new Date('2026-08-10T09:00:00Z'))).toBe('2026-08-10');
  });

  it('uses the local date, not the UTC date, when the two differ in summer', () => {
    // 22:30Z is already 01:30 the next morning in Israel (UTC+3 in August).
    const instant = new Date('2026-08-10T22:30:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-10');
    expect(toLocalDate(instant)).toBe('2026-08-11');
  });

  it('uses the local date, not the UTC date, when the two differ in winter', () => {
    // 22:30Z is 00:30 the next morning in Israel (UTC+2 in January).
    const instant = new Date('2026-01-10T22:30:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-01-10');
    expect(toLocalDate(instant)).toBe('2026-01-11');
  });

  it('keeps an instant on its own UTC date when the offset does not push it over', () => {
    expect(toLocalDate(new Date('2026-08-10T20:30:00Z'))).toBe('2026-08-10');
    expect(toLocalDate(new Date('2026-01-10T21:30:00Z'))).toBe('2026-01-10');
  });

  it('rejects an invalid date rather than emitting a malformed string', () => {
    expect(() => toLocalDate(new Date('not a date'))).toThrow(RangeError);
  });
});

describe('toLocalDate across Israeli DST transitions', () => {
  // Israel enters DST at 02:00 on the Friday before the last Sunday in March,
  // and leaves it at 02:00 on the last Sunday in October. In 2026 that is
  // 2026-03-27 (UTC+2 -> UTC+3) and 2026-10-25 (UTC+3 -> UTC+2).

  it('buckets instants on either side of the spring-forward correctly', () => {
    // 23:30Z on the 26th is 01:30 on the 27th, still at UTC+2.
    expect(toLocalDate(new Date('2026-03-26T23:30:00Z'))).toBe('2026-03-27');
    // 00:30Z on the 27th is 03:30, the clock having jumped over 02:00.
    expect(toLocalDate(new Date('2026-03-27T00:30:00Z'))).toBe('2026-03-27');
    // The evening before is still the 26th locally.
    expect(toLocalDate(new Date('2026-03-26T20:30:00Z'))).toBe('2026-03-26');
  });

  it('buckets both halves of the repeated hour at the autumn fall-back onto the same day', () => {
    // 01:30 local happens twice on 2026-10-25 — once at UTC+3, once at UTC+2.
    const firstPass = new Date('2026-10-24T22:30:00Z');
    const secondPass = new Date('2026-10-24T23:30:00Z');

    expect(toLocalDate(firstPass)).toBe('2026-10-25');
    expect(toLocalDate(secondPass)).toBe('2026-10-25');
    // Distinct instants, same local day: neither is skipped or double-counted.
    expect(firstPass.getTime()).not.toBe(secondPass.getTime());
    expect(isSameLocalDate(firstPass, secondPass)).toBe(true);
  });

  it('keeps the day before the fall-back on its own date', () => {
    expect(toLocalDate(new Date('2026-10-24T20:30:00Z'))).toBe('2026-10-24');
  });
});

describe('isSameLocalDate', () => {
  it('is true for two instants on the same local day', () => {
    expect(
      isSameLocalDate(new Date('2026-08-10T06:00:00Z'), new Date('2026-08-10T14:00:00Z')),
    ).toBe(true);
  });

  it('is false across a local midnight even when the UTC date matches', () => {
    // Both are 2026-08-10 in UTC, but 22:30Z is already the 11th in Israel.
    expect(
      isSameLocalDate(new Date('2026-08-10T14:00:00Z'), new Date('2026-08-10T22:30:00Z')),
    ).toBe(false);
  });
});

describe('toYearMonth', () => {
  it('splits a local date into year and 1-based month', () => {
    expect(toYearMonth('2026-08-11')).toEqual({ year: 2026, month: 8 });
  });

  it('keeps January as month 1', () => {
    expect(toYearMonth('2026-01-01')).toEqual({ year: 2026, month: 1 });
  });

  it('rejects a value that is not a YYYY-MM-DD date', () => {
    expect(() => toYearMonth('2026-8-1')).toThrow(RangeError);
    expect(() => toYearMonth('2026-08-11T00:00:00Z')).toThrow(RangeError);
  });

  it('rejects a well-formed date that names no real day', () => {
    expect(() => toYearMonth('2026-13-01')).toThrow(RangeError);
    expect(() => toYearMonth('2026-02-30')).toThrow(RangeError);
  });
});

describe('isCalendarDate', () => {
  it('accepts real days', () => {
    expect(isCalendarDate('2026-08-11')).toBe(true);
    expect(isCalendarDate('2026-01-01')).toBe(true);
    expect(isCalendarDate('2026-12-31')).toBe(true);
  });

  it('accepts 29 February only in a leap year', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });

  it('rejects an out-of-range month or day', () => {
    // `new Date('2026-13-01')` is an Invalid Date; `new Date('2026-02-30')`
    // silently becomes March 2. Neither may reach a query.
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-00-10')).toBe(false);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(isCalendarDate('2026-08-00')).toBe(false);
    expect(isCalendarDate('2026-08-32')).toBe(false);
  });

  it('rejects anything not shaped YYYY-MM-DD', () => {
    expect(isCalendarDate('2026-8-1')).toBe(false);
    expect(isCalendarDate('11/08/2026')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });

  it('rejects a two-digit year rather than letting Date.UTC read it as 19xx', () => {
    expect(isCalendarDate('0026-08-11')).toBe(false);
  });
});

describe('APP_TIME_ZONE', () => {
  it('is the Israeli zone every day-boundary decision is made in', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Jerusalem');
  });
});
