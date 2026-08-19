import { describe, it, expect } from 'vitest';
import {
  MAX_TIME_ENTRY_RANGE_DAYS,
  TimeEntriesListQuerySchema,
  TimeEntryListItemSchema,
} from './list.js';

describe('TimeEntriesListQuerySchema', () => {
  it('accepts a single date', () => {
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-08-10' }).success).toBe(true);
  });

  it('accepts a complete range', () => {
    const query = { from: '2026-08-01', to: '2026-08-31' };
    expect(TimeEntriesListQuerySchema.safeParse(query).success).toBe(true);
  });

  it('accepts a single-day range', () => {
    const query = { from: '2026-08-10', to: '2026-08-10' };
    expect(TimeEntriesListQuerySchema.safeParse(query).success).toBe(true);
  });

  it('rejects an empty query — the period must be stated', () => {
    expect(TimeEntriesListQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects mixing a single date with a range', () => {
    const query = { date: '2026-08-10', from: '2026-08-01', to: '2026-08-31' };
    expect(TimeEntriesListQuerySchema.safeParse(query).success).toBe(false);
  });

  it('rejects a half-open range rather than guessing the missing end', () => {
    expect(TimeEntriesListQuerySchema.safeParse({ from: '2026-08-01' }).success).toBe(false);
    expect(TimeEntriesListQuerySchema.safeParse({ to: '2026-08-31' }).success).toBe(false);
  });

  it('rejects a backwards range', () => {
    const result = TimeEntriesListQuerySchema.safeParse({ from: '2026-08-31', to: '2026-08-01' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-DATE-RANGE');
  });

  it('rejects a malformed date', () => {
    expect(TimeEntriesListQuerySchema.safeParse({ date: '10/08/2026' }).success).toBe(false);
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-8-1' }).success).toBe(false);
  });

  /**
   * Well-formed but impossible dates are the dangerous ones: month 13 reaches
   * `new Date()` as an Invalid Date and surfaces as a 500, while 30 February
   * quietly rolls over and answers about a day nobody asked for.
   */
  it('rejects a well-formed date that is not a real day', () => {
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-13-01' }).success).toBe(false);
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-00-10' }).success).toBe(false);
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-04-31' }).success).toBe(false);
    expect(
      TimeEntriesListQuerySchema.safeParse({ from: '2026-13-01', to: '2026-13-05' }).success,
    ).toBe(false);
  });

  it('accepts 29 February in a leap year', () => {
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2028-02-29' }).success).toBe(true);
    expect(TimeEntriesListQuerySchema.safeParse({ date: '2026-02-29' }).success).toBe(false);
  });

  it(`accepts a range exactly ${MAX_TIME_ENTRY_RANGE_DAYS} days wide`, () => {
    // 2028 is a leap year, so 1 Jan – 31 Dec inclusive is exactly 366 days.
    const query = { from: '2028-01-01', to: '2028-12-31' };
    expect(TimeEntriesListQuerySchema.safeParse(query).success).toBe(true);
  });

  it('rejects a range wider than the cap — the response is unpaged', () => {
    const result = TimeEntriesListQuerySchema.safeParse({ from: '1900-01-01', to: '2100-12-31' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-DATE-RANGE');
  });

  it('rejects a range one day past the cap', () => {
    const query = { from: '2028-01-01', to: '2029-01-01' };
    expect(TimeEntriesListQuerySchema.safeParse(query).success).toBe(false);
  });

  it('reports VAL-DATE-RANGE for every rejection so one message can serve them', () => {
    for (const query of [{}, { from: '2026-08-01' }, { from: '2026-08-31', to: '2026-08-01' }]) {
      const result = TimeEntriesListQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-DATE-RANGE');
    }
  });
});

describe('TimeEntryListItemSchema', () => {
  const item = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: '2026-08-10',
    startAt: '2026-08-10T06:00:00.000Z',
    endAt: '2026-08-10T15:00:00.000Z',
    location: 'office' as const,
    description: 'Sprint work',
    taskId: '550e8400-e29b-41d4-a716-446655440001',
    taskName: 'UI Design',
    projectId: '550e8400-e29b-41d4-a716-446655440002',
    projectName: 'Website Redesign',
    clientId: '550e8400-e29b-41d4-a716-446655440003',
    clientName: 'Acme',
  };

  it('accepts a complete entry', () => {
    expect(TimeEntryListItemSchema.safeParse(item).success).toBe(true);
  });

  it('carries denormalised names so a closed task still renders', () => {
    const parsed = TimeEntryListItemSchema.parse(item);
    expect(parsed.taskName).toBe('UI Design');
    expect(parsed.projectName).toBe('Website Redesign');
    expect(parsed.clientName).toBe('Acme');
  });

  it('accepts a null description and location', () => {
    const result = TimeEntryListItemSchema.safeParse({
      ...item,
      description: null,
      location: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a running entry with no end time and no task', () => {
    // This epic never creates one, but the read path must tolerate what the
    // Punch Clock epic will write.
    const result = TimeEntryListItemSchema.safeParse({
      ...item,
      endAt: null,
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientId: null,
      clientName: null,
      location: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed date field', () => {
    expect(TimeEntryListItemSchema.safeParse({ ...item, date: 'yesterday' }).success).toBe(false);
  });
});

/**
 * Nest runs on Express, which hands a duplicated `?date=a&date=b` over as an
 * array. That aborted `z.string()` with a raw English message under the
 * `VAL-QUERY` fallback rule — which has no Hebrew entry — and skipped the
 * range rules entirely.
 */
describe('TimeEntriesListQuerySchema — wrong-typed query values', () => {
  function messagesFor(query: unknown): string[] {
    const result = TimeEntriesListQuerySchema.safeParse(query);
    if (result.success) return [];
    return result.error.issues.map((issue) => issue.message);
  }

  it('reports VAL-DATE-RANGE for a duplicated date param', () => {
    expect(messagesFor({ date: ['2026-08-10', '2026-08-11'] })).toEqual(['VAL-DATE-RANGE']);
  });

  it('reports VAL-DATE-RANGE for a duplicated range param', () => {
    const messages = messagesFor({ from: ['2026-08-01', '2026-08-02'], to: '2026-08-31' });
    expect(messages).toContain('VAL-DATE-RANGE');
    expect(messages.every((message) => message === 'VAL-DATE-RANGE')).toBe(true);
  });

  it('never leaks a raw zod type message', () => {
    for (const query of [{ date: 42 }, { date: {} }, { from: null, to: '2026-08-31' }]) {
      const messages = messagesFor(query);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((message) => message === 'VAL-DATE-RANGE')).toBe(true);
    }
  });

  it('does not crash comparing a range whose ends are not strings', () => {
    expect(() =>
      TimeEntriesListQuerySchema.safeParse({ from: ['a'], to: ['b'] }),
    ).not.toThrow();
  });
});
