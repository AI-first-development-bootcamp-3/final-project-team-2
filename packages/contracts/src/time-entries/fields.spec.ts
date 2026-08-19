import { describe, it, expect } from 'vitest';
import { WorkLocation } from '../enums.js';
import { TimeEntryLocationSchema } from './fields.js';

/**
 * These were two unlinked declarations of the same wire enum: a value added to
 * `WorkLocation` but not to the time-entry schema would be rejected as VAL-36
 * while the rest of the app considered it valid, and `TimeEntryListItemSchema`
 * would fail to parse rows the server legitimately returned.
 */
describe('TimeEntryLocationSchema is derived from WorkLocation', () => {
  it('accepts every location the wire enum defines', () => {
    for (const location of WorkLocation.options) {
      expect(TimeEntryLocationSchema.safeParse(location).success).toBe(true);
    }
  });

  it('reports VAL-36 for a value outside the set', () => {
    const result = TimeEntryLocationSchema.safeParse('cafe');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual(['VAL-36']);
  });

  it('reports VAL-36 for a missing or wrong-typed value alike', () => {
    expect(TimeEntryLocationSchema.safeParse(undefined).success).toBe(false);
    expect(TimeEntryLocationSchema.safeParse(42).success).toBe(false);
  });
});
