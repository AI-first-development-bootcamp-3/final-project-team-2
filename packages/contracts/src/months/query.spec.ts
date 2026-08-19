import { describe, it, expect } from 'vitest';
import { MonthQueryResponseSchema } from '../index';

const entry = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  date: '2026-08-03',
  startAt: '2026-08-03T05:00:00.000Z',
  endAt: '2026-08-03T14:00:00.000Z',
  location: 'office' as const,
  description: null,
  taskId: '660e8400-e29b-41d4-a716-446655440000',
  taskName: 'Task One',
  projectId: '770e8400-e29b-41d4-a716-446655440000',
  projectName: 'Project Alpha',
  clientId: '880e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
};

const absence = {
  startDate: '2026-08-10',
  endDate: '2026-08-12',
};

describe('MonthQueryResponseSchema', () => {
  it('accepts a month with entries, absences, and a locked month', () => {
    const response = {
      data: {
        entries: [entry],
        absences: [absence],
        lock: { isLocked: true, lockedAt: '2026-09-01T08:00:00.000Z' },
      },
    };

    expect(MonthQueryResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts an empty open month', () => {
    const response = {
      data: {
        entries: [],
        absences: [],
        lock: { isLocked: false, lockedAt: null },
      },
    };

    expect(MonthQueryResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts a locked month whose lock instant is unknown', () => {
    // The lock outranks its own bookkeeping: `isLocked` alone must be enough
    // for the client to go read-only, so a null `lockedAt` stays valid.
    const response = {
      data: {
        entries: [],
        absences: [],
        lock: { isLocked: true, lockedAt: null },
      },
    };

    expect(MonthQueryResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a payload missing the absences key', () => {
    const result = MonthQueryResponseSchema.safeParse({
      data: {
        entries: [],
        lock: { isLocked: false, lockedAt: null },
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an absence outside the local-date shape', () => {
    const result = MonthQueryResponseSchema.safeParse({
      data: {
        entries: [],
        absences: [{ startDate: '2026-08-10T00:00:00.000Z', endDate: '2026-08-12' }],
        lock: { isLocked: false, lockedAt: null },
      },
    });

    expect(result.success).toBe(false);
  });
});
