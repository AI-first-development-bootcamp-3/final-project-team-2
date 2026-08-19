import { describe, it, expect } from 'vitest';
import {
  UpdateTimeEntryBodySchema,
  MergedTimeEntrySchema,
  CompletedTimeEntrySchema,
} from './update.js';
import { ROOT_DETAIL_FIELD, zodIssuesToDetails } from '../common/api-error.js';

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

/**
 * A running entry has no end time, and design D7 shapes these seams so the
 * Punch Clock epic inherits them rather than rewriting them. The merged rules
 * previously required an end, a task, and a location unconditionally, so no
 * running entry could ever pass the re-validation this schema prescribes for
 * every PATCH.
 */
describe('MergedTimeEntrySchema — running entries (§8.6, D7)', () => {
  const running = {
    taskId: null,
    date: '2026-08-10',
    startAt: '2026-08-10T06:00:00.000Z',
    endAt: null,
    location: null,
  };

  it('accepts a running entry patched only in its description', () => {
    const result = MergedTimeEntrySchema.safeParse({ ...running, description: 'lunch' });
    expect(result.success).toBe(true);
  });

  it('accepts a running entry whose end time is simply absent', () => {
    expect(MergedTimeEntrySchema.safeParse(omit(running, 'endAt')).success).toBe(true);
  });

  it('exempts a running entry from VAL-31', () => {
    // No end time means nothing to compare the start against.
    const result = MergedTimeEntrySchema.safeParse(running);
    expect(result.success).toBe(true);
  });

  it('still applies VAL-38 to a running entry', () => {
    const result = MergedTimeEntrySchema.safeParse({ ...running, date: '2026-08-11' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-38');
  });

  it('requires a task and a location once an end time is present', () => {
    const result = MergedTimeEntrySchema.safeParse({
      ...running,
      endAt: '2026-08-10T15:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(['VAL-35', 'VAL-36']),
    );
  });
});

describe('CompletedTimeEntrySchema', () => {
  const completed = {
    taskId: TASK_ID,
    date: '2026-08-10',
    startAt: '2026-08-10T06:00:00.000Z',
    endAt: '2026-08-10T15:00:00.000Z',
    location: 'office' as const,
  };

  it('accepts a completed entry', () => {
    expect(CompletedTimeEntrySchema.safeParse(completed).success).toBe(true);
  });

  it('refuses a running entry with VAL-31 — this epic never edits one', () => {
    const result = CompletedTimeEntrySchema.safeParse({ ...completed, endAt: null, taskId: null });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain('VAL-31');
  });
});

describe('UpdateTimeEntryBodySchema — an empty patch is reportable', () => {
  it('reports VAL-EMPTY-UPDATE at the root, where no input matches', () => {
    const result = UpdateTimeEntryBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const details = zodIssuesToDetails(result.error.issues);
    // Consumers must render this through `partitionDetails`; keyed by field
    // alone it lands on a key no input reads and the save silently does nothing.
    expect(details).toEqual([
      expect.objectContaining({ field: ROOT_DETAIL_FIELD, rule: 'VAL-EMPTY-UPDATE' }),
    ]);
  });
});
