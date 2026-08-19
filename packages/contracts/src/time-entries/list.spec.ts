import { describe, it, expect } from 'vitest';
import { TimeEntriesListQuerySchema, TimeEntryListItemSchema } from './list.js';

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

describe('TimeEntriesListQuerySchema — hostile query values', () => {
  it('reports VAL-DATE-RANGE for a duplicated parameter arriving as an array', () => {
    // Express turns `?date=a&date=b` into an array; zod's default message would
    // surface raw English under the catch-all VAL-QUERY rule, which has no
    // Hebrew entry.
    const result = TimeEntriesListQuerySchema.safeParse({ date: ['2026-08-10', '2026-08-11'] });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-DATE-RANGE');
  });

  it.each(['2026-02-30', '2026-13-01'])('rejects the calendar-invalid date %s', (date) => {
    const result = TimeEntriesListQuerySchema.safeParse({ date });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-DATE-RANGE');
  });

  it('rejects a calendar-invalid range bound', () => {
    const result = TimeEntriesListQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-31' });
    expect(result.success).toBe(false);
  });
});
