import { describe, expect, it } from 'vitest';
import { MergedAbsenceSchema, UpdateAbsenceBodySchema } from './update.js';

// 2026-08-17 Mon · 19 Wed · 20 Thu · 21 Fri · 22 Sat · 23 Sun

function rules(schema: typeof UpdateAbsenceBodySchema, body: unknown): Record<string, string[]> {
  const result = schema.safeParse(body);
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

describe('UpdateAbsenceBodySchema', () => {
  it('accepts a single changed field', () => {
    expect(UpdateAbsenceBodySchema.safeParse({ type: 'sick' }).success).toBe(true);
  });

  it('accepts a notes-only edit', () => {
    expect(UpdateAbsenceBodySchema.safeParse({ notes: 'עודכן' }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(rules(UpdateAbsenceBodySchema, {})).toEqual({ '(root)': ['VAL-EMPTY-UPDATE'] });
  });

  it('applies VAL-42 when both bounds are supplied', () => {
    expect(
      rules(UpdateAbsenceBodySchema, { startDate: '2026-08-20', endDate: '2026-08-17' }),
    ).toEqual({ endDate: ['VAL-42'] });
  });

  it('applies VAL-43 to a supplied weekend bound', () => {
    expect(rules(UpdateAbsenceBodySchema, { startDate: '2026-08-21' })).toEqual({
      startDate: ['VAL-43'],
    });
  });

  it('skips a rule whose other operand is absent', () => {
    // Only the end date moves; VAL-42 needs both, so the API re-runs it against
    // the merged absence instead of complaining here.
    expect(UpdateAbsenceBodySchema.safeParse({ endDate: '2026-08-19' }).success).toBe(true);
  });

  it('rejects a period without the half-day flag', () => {
    expect(rules(UpdateAbsenceBodySchema, { halfDayPeriod: 'morning' })).toEqual({
      halfDayPeriod: ['VAL-ABSENCE-HALF-DAY'],
    });
  });

  it('rejects turning on the half-day flag without a period', () => {
    expect(rules(UpdateAbsenceBodySchema, { isHalfDay: true })).toEqual({
      halfDayPeriod: ['VAL-ABSENCE-HALF-DAY'],
    });
  });

  it('rejects an impossible date', () => {
    expect(rules(UpdateAbsenceBodySchema, { startDate: '2026-02-30' })).toEqual({
      startDate: ['VAL-41'],
    });
  });
});

describe('MergedAbsenceSchema', () => {
  const merged = {
    type: 'vacation',
    startDate: '2026-08-17',
    endDate: '2026-08-19',
    isHalfDay: false,
    halfDayPeriod: null,
    notes: null,
  } as const;

  it('accepts a coherent merged absence', () => {
    expect(MergedAbsenceSchema.safeParse(merged).success).toBe(true);
  });

  it('catches a patch that would move the end date onto a Saturday', () => {
    // The whole point of re-validating the merge: the patch only sent endDate,
    // so the update body alone could not have caught this.
    const result = MergedAbsenceSchema.safeParse({ ...merged, endDate: '2026-08-22' });
    expect(result.success).toBe(false);
  });

  it('catches a patch that would invert the range', () => {
    const result = MergedAbsenceSchema.safeParse({ ...merged, startDate: '2026-08-20' });
    expect(result.success).toBe(false);
  });

  it('requires every field — a merge is a complete absence', () => {
    expect(MergedAbsenceSchema.safeParse({ type: 'vacation' }).success).toBe(false);
  });

  it('catches a half day left spanning a range', () => {
    const result = MergedAbsenceSchema.safeParse({
      ...merged,
      isHalfDay: true,
      halfDayPeriod: 'morning',
    });
    expect(result.success).toBe(false);
  });
});
