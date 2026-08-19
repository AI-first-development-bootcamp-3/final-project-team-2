import { describe, expect, it } from 'vitest';
import { CreateAbsenceBodySchema } from './create.js';

// 2026-08-16 Sun · 17 Mon · 20 Thu · 21 Fri · 22 Sat · 23 Sun
const base = { type: 'vacation', startDate: '2026-08-17', endDate: '2026-08-17' } as const;

/** The rule codes reported against each field, for terse assertions. */
function rules(body: unknown): Record<string, string[]> {
  const result = CreateAbsenceBodySchema.safeParse(body);
  if (result.success) {
    return {};
  }

  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '(root)';
    (byField[field] ??= []).push(issue.message);
  }
  return byField;
}

describe('CreateAbsenceBodySchema', () => {
  it('accepts a single working day', () => {
    expect(CreateAbsenceBodySchema.safeParse(base).success).toBe(true);
  });

  it('accepts each of the four types', () => {
    for (const type of ['vacation', 'sick', 'military', 'other']) {
      expect(CreateAbsenceBodySchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });

  it('reports VAL-40 for an unrecognised type', () => {
    expect(rules({ ...base, type: 'holiday' })).toEqual({ type: ['VAL-40'] });
  });

  it('reports VAL-40 for a missing type', () => {
    expect(rules({ startDate: '2026-08-17', endDate: '2026-08-17' })).toEqual({
      type: ['VAL-40'],
    });
  });

  it('reports VAL-41 for a missing start date', () => {
    expect(rules({ type: 'vacation', endDate: '2026-08-17' })).toEqual({
      startDate: ['VAL-41'],
    });
  });

  it('reports VAL-42 when the end date precedes the start date', () => {
    expect(rules({ ...base, startDate: '2026-08-20', endDate: '2026-08-17' })).toEqual({
      endDate: ['VAL-42'],
    });
  });

  it('accepts a range across a weekend — splitting happens on the way to storage', () => {
    expect(
      CreateAbsenceBodySchema.safeParse({ ...base, startDate: '2026-08-20', endDate: '2026-08-23' })
        .success,
    ).toBe(true);
  });

  it('reports VAL-43 when the start date is a Friday', () => {
    expect(rules({ ...base, startDate: '2026-08-21', endDate: '2026-08-23' })).toEqual({
      startDate: ['VAL-43'],
    });
  });

  it('reports VAL-43 when the end date is a Saturday', () => {
    expect(rules({ ...base, startDate: '2026-08-20', endDate: '2026-08-22' })).toEqual({
      endDate: ['VAL-43'],
    });
  });

  it('reports VAL-43 against both bounds of a weekend-only range', () => {
    expect(rules({ ...base, startDate: '2026-08-21', endDate: '2026-08-22' })).toEqual({
      startDate: ['VAL-43'],
      endDate: ['VAL-43'],
    });
  });

  it('accepts a half day with a period', () => {
    const parsed = CreateAbsenceBodySchema.safeParse({
      ...base,
      isHalfDay: true,
      halfDayPeriod: 'morning',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a half day without a period', () => {
    expect(rules({ ...base, isHalfDay: true })).toEqual({
      halfDayPeriod: ['VAL-ABSENCE-HALF-DAY'],
    });
  });

  it('rejects a period without the half-day flag', () => {
    expect(rules({ ...base, halfDayPeriod: 'afternoon' })).toEqual({
      halfDayPeriod: ['VAL-ABSENCE-HALF-DAY'],
    });
  });

  it('rejects a half day spanning more than one date', () => {
    expect(
      rules({
        ...base,
        startDate: '2026-08-17',
        endDate: '2026-08-19',
        isHalfDay: true,
        halfDayPeriod: 'morning',
      }),
    ).toEqual({ endDate: ['VAL-ABSENCE-HALF-DAY'] });
  });

  it('defaults isHalfDay to false', () => {
    const parsed = CreateAbsenceBodySchema.parse(base);
    expect(parsed.isHalfDay).toBe(false);
  });

  it('accepts optional notes and trims them', () => {
    const parsed = CreateAbsenceBodySchema.parse({ ...base, notes: '  חופשה משפחתית  ' });
    expect(parsed.notes).toBe('חופשה משפחתית');
  });

  it('rejects a date that matches the pattern but is not a real day', () => {
    // `2026-02-30` passes the regex, and the Date constructor rolls it forward
    // to March 2nd rather than failing — so without an explicit check an
    // impossible date would reach the database.
    expect(rules({ ...base, startDate: '2026-02-30', endDate: '2026-02-30' })).toEqual({
      startDate: ['VAL-41'],
      endDate: ['VAL-42'],
    });
  });

  it('rejects an impossible day in a non-leap February', () => {
    expect(rules({ ...base, startDate: '2027-02-29', endDate: '2027-02-29' })).toEqual({
      startDate: ['VAL-41'],
      endDate: ['VAL-42'],
    });
  });

  it('accepts a real leap day', () => {
    // 2028-02-29 is a Tuesday.
    expect(
      CreateAbsenceBodySchema.safeParse({
        ...base,
        startDate: '2028-02-29',
        endDate: '2028-02-29',
      }).success,
    ).toBe(true);
  });

  it('does not throw out of safeParse on an impossible date', () => {
    // The cross-field rules must not construct an Invalid Date and throw —
    // that would turn a 400 into a 500.
    expect(() =>
      CreateAbsenceBodySchema.safeParse({ ...base, startDate: '2026-13-45', endDate: 'nonsense' }),
    ).not.toThrow();
  });
});
