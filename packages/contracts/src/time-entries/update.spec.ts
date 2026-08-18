import { describe, it, expect } from 'vitest';
import { UpdateTimeEntryBodySchema, MergedTimeEntrySchema } from './update.js';

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';

/** Builds a body with one field removed, without tripping no-unused-vars. */
function omit<T extends object, K extends keyof T>(source: T, key: K): Omit<T, K> {
  const clone = { ...source };
  delete clone[key];
  return clone;
}

function rulesFor(body: unknown, field: string): string[] {
  const result = UpdateTimeEntryBodySchema.safeParse(body);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join('.') === field)
    .map((issue) => issue.message);
}

describe('UpdateTimeEntryBodySchema — partial edits', () => {
  it('accepts a single changed field', () => {
    expect(UpdateTimeEntryBodySchema.safeParse({ location: 'home' }).success).toBe(true);
    expect(UpdateTimeEntryBodySchema.safeParse({ taskId: TASK_ID }).success).toBe(true);
  });

  it('accepts a description cleared with an explicit null', () => {
    const result = UpdateTimeEntryBodySchema.parse({ description: null });
    expect(result.description).toBeNull();
  });

  it('rejects an empty patch', () => {
    expect(rulesFor({}, '')).toContain('VAL-EMPTY-UPDATE');
  });

  it('skips VAL-31 when only one side of the pair is supplied', () => {
    // The API re-validates against the merged entry; this layer cannot know
    // what the stored end time is.
    expect(
      UpdateTimeEntryBodySchema.safeParse({ startAt: '2026-08-10T06:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('still applies VAL-31 when both times are supplied', () => {
    const body = {
      startAt: '2026-08-10T15:00:00.000Z',
      endAt: '2026-08-10T06:00:00.000Z',
    };
    expect(rulesFor(body, 'endAt')).toContain('VAL-31');
  });

  it('still applies VAL-38 when both the date and the start are supplied', () => {
    const body = { date: '2026-08-11', startAt: '2026-08-10T06:00:00.000Z' };
    expect(rulesFor(body, 'date')).toContain('VAL-38');
  });

  it('rejects an invalid field even in a partial patch', () => {
    expect(rulesFor({ location: 'cafe' }, 'location')).toContain('VAL-36');
    expect(rulesFor({ taskId: 'nope' }, 'taskId')).toContain('VAL-35');
  });
});

describe('MergedTimeEntrySchema — the post-merge contract', () => {
  const merged = {
    taskId: TASK_ID,
    date: '2026-08-10',
    startAt: '2026-08-10T06:00:00.000Z',
    endAt: '2026-08-10T15:00:00.000Z',
    location: 'office' as const,
    description: null,
  };

  it('accepts a fully valid merged entry', () => {
    expect(MergedTimeEntrySchema.safeParse(merged).success).toBe(true);
  });

  it('holds an edit to the same rules a create would enforce', () => {
    // A patch that moved the start past the stored end must not survive the merge.
    const result = MergedTimeEntrySchema.safeParse({
      ...merged,
      startAt: '2026-08-10T16:00:00.000Z',
      date: '2026-08-10',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-31');
  });

  it('rejects a merged entry that lost its task', () => {
    const withoutTask = omit(merged, 'taskId');
    const result = MergedTimeEntrySchema.safeParse(withoutTask);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-35');
  });

  it('rejects a merged entry whose date no longer matches its start day', () => {
    const result = MergedTimeEntrySchema.safeParse({ ...merged, date: '2026-08-09' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-38');
  });
});

describe('refinement robustness', () => {
  it('reports a rule code rather than throwing when a time is unparseable', () => {
    // Zod runs object-level refinements even after a field fails, so the
    // cross-field rules must tolerate garbage rather than construct an
    // Invalid Date and escape safeParse.
    const result = UpdateTimeEntryBodySchema.safeParse({
      startAt: 'not-a-date',
      date: '2026-08-10',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-30');
  });

  it('does not throw when both times are unparseable', () => {
    expect(() => UpdateTimeEntryBodySchema.safeParse({ startAt: 'x', endAt: 'y' })).not.toThrow();
  });
});
