import { describe, it, expect } from 'vitest';
import { CreateTimeEntryBodySchema } from './create.js';

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';

/** A valid nine-to-six day. Israel is UTC+3 in August. */
const validBody = {
  taskId: TASK_ID,
  date: '2026-08-10',
  startAt: '2026-08-10T06:00:00.000Z', // 09:00 local
  endAt: '2026-08-10T15:00:00.000Z', // 18:00 local
  location: 'office' as const,
};

/** Builds a body with one field removed, without tripping no-unused-vars. */
function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const clone = { ...source };
  delete clone[key];
  return clone;
}

/** The rule codes reported for a field, so assertions read like the spec. */
function rulesFor(body: unknown, field: string): string[] {
  const result = CreateTimeEntryBodySchema.safeParse(body);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join('.') === field)
    .map((issue) => issue.message);
}

describe('CreateTimeEntryBodySchema — acceptance', () => {
  it('accepts a valid body', () => {
    const result = CreateTimeEntryBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('accepts an optional description and trims it', () => {
    const result = CreateTimeEntryBodySchema.parse({ ...validBody, description: '  notes  ' });
    expect(result.description).toBe('notes');
  });

  it('accepts each permitted work location', () => {
    for (const location of ['office', 'client_site', 'home'] as const) {
      expect(CreateTimeEntryBodySchema.safeParse({ ...validBody, location }).success).toBe(true);
    }
  });

  it('accepts an offset-bearing instant as well as a Z instant', () => {
    const result = CreateTimeEntryBodySchema.safeParse({
      ...validBody,
      startAt: '2026-08-10T09:00:00.000+03:00',
      endAt: '2026-08-10T18:00:00.000+03:00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a one-minute entry, since no minimum duration applies', () => {
    const result = CreateTimeEntryBodySchema.safeParse({
      ...validBody,
      startAt: '2026-08-10T06:00:00.000Z',
      endAt: '2026-08-10T06:01:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateTimeEntryBodySchema — VAL-30 start time required', () => {
  it('rejects a missing start time', () => {
    const body = omit(validBody, 'startAt');
    expect(rulesFor(body, 'startAt')).toContain('VAL-30');
  });

  it('rejects an empty start time', () => {
    expect(rulesFor({ ...validBody, startAt: '' }, 'startAt')).toContain('VAL-30');
  });

  it('rejects a start time that is not an instant', () => {
    expect(rulesFor({ ...validBody, startAt: '2026-08-10' }, 'startAt')).toContain('VAL-30');
  });
});

describe('CreateTimeEntryBodySchema — VAL-31 end after start', () => {
  it('rejects an end before the start', () => {
    const body = { ...validBody, endAt: '2026-08-10T05:00:00.000Z' };
    expect(rulesFor(body, 'endAt')).toContain('VAL-31');
  });

  it('rejects an end equal to the start', () => {
    const body = { ...validBody, endAt: validBody.startAt };
    expect(rulesFor(body, 'endAt')).toContain('VAL-31');
  });

  it('rejects a missing end time', () => {
    const body = omit(validBody, 'endAt');
    expect(rulesFor(body, 'endAt')).toContain('VAL-31');
  });

  it('accepts a night shift crossing midnight', () => {
    // 22:00 on the 10th to 06:00 on the 11th, local.
    const result = CreateTimeEntryBodySchema.safeParse({
      ...validBody,
      date: '2026-08-10',
      startAt: '2026-08-10T19:00:00.000Z',
      endAt: '2026-08-11T03:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateTimeEntryBodySchema — VAL-35 task required', () => {
  it('rejects a missing task', () => {
    const body = omit(validBody, 'taskId');
    expect(rulesFor(body, 'taskId')).toContain('VAL-35');
  });

  it('rejects a task reference that is not a UUID', () => {
    expect(rulesFor({ ...validBody, taskId: 'not-a-uuid' }, 'taskId')).toContain('VAL-35');
  });
});

describe('CreateTimeEntryBodySchema — VAL-36 location required', () => {
  it('rejects a missing location', () => {
    const body = omit(validBody, 'location');
    expect(rulesFor(body, 'location')).toContain('VAL-36');
  });

  it('rejects a location outside the permitted set', () => {
    expect(rulesFor({ ...validBody, location: 'cafe' }, 'location')).toContain('VAL-36');
  });

  it('rejects a wrong-typed location', () => {
    expect(rulesFor({ ...validBody, location: 42 }, 'location')).toContain('VAL-36');
  });
});

describe('CreateTimeEntryBodySchema — VAL-38 date matches the start day', () => {
  it('rejects a date that disagrees with the start instant', () => {
    expect(rulesFor({ ...validBody, date: '2026-08-11' }, 'date')).toContain('VAL-38');
  });

  it('rejects a malformed date', () => {
    expect(rulesFor({ ...validBody, date: '10/08/2026' }, 'date')).toContain('VAL-38');
  });

  it('keeps a night shift on its start date', () => {
    const result = CreateTimeEntryBodySchema.safeParse({
      ...validBody,
      date: '2026-08-10',
      startAt: '2026-08-10T19:00:00.000Z', // 22:00 local on the 10th
      endAt: '2026-08-11T03:00:00.000Z', // 06:00 local on the 11th
    });
    expect(result.success).toBe(true);
  });

  it('rejects a night shift dated to the day it ended', () => {
    const body = {
      ...validBody,
      date: '2026-08-11',
      startAt: '2026-08-10T19:00:00.000Z',
      endAt: '2026-08-11T03:00:00.000Z',
    };
    expect(rulesFor(body, 'date')).toContain('VAL-38');
  });

  it('uses the local day, not the UTC day, when the two differ', () => {
    // 22:30Z on the 10th is 01:30 local on the 11th.
    const body = {
      ...validBody,
      startAt: '2026-08-10T22:30:00.000Z',
      endAt: '2026-08-11T01:00:00.000Z',
    };

    expect(rulesFor({ ...body, date: '2026-08-10' }, 'date')).toContain('VAL-38');
    expect(CreateTimeEntryBodySchema.safeParse({ ...body, date: '2026-08-11' }).success).toBe(true);
  });
});

describe('CreateTimeEntryBodySchema — multiple violations', () => {
  it('reports every broken rule together, not just the first', () => {
    const result = CreateTimeEntryBodySchema.safeParse({ date: '2026-08-10' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining(['VAL-30', 'VAL-31', 'VAL-35', 'VAL-36']));
  });
});
