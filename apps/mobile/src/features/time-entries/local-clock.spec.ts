import { describe, it, expect } from 'vitest';
import { addLocalDay, formTimesToUtc, utcIsoToLocalClock } from './local-clock';

describe('formTimesToUtc', () => {
  it('converts an Asia/Jerusalem afternoon to the matching UTC instant', () => {
    // 14:00 IDT (UTC+3 in August) → 11:00 UTC.
    const result = formTimesToUtc('2026-08-10', '14:00', '18:00');

    expect(result.date).toBe('2026-08-10');
    expect(result.startAt).toBe('2026-08-10T11:00:00.000Z');
    expect(result.endAt).toBe('2026-08-10T15:00:00.000Z');
  });

  it('submits a night shift whose end is earlier on the clock as the following day', () => {
    const result = formTimesToUtc('2026-08-10', '22:00', '06:00');

    expect(result.date).toBe('2026-08-10');
    expect(result.startAt).toBe('2026-08-10T19:00:00.000Z');
    expect(result.endAt).toBe('2026-08-11T03:00:00.000Z');
  });

  it('keeps winter Israel on UTC+2', () => {
    const result = formTimesToUtc('2026-01-10', '14:00', '18:00');

    expect(result.startAt).toBe('2026-01-10T12:00:00.000Z');
    expect(result.endAt).toBe('2026-01-10T16:00:00.000Z');
  });

  it('derives date from the start instant so VAL-38 is satisfied', () => {
    const result = formTimesToUtc('2026-08-10', '00:30', '08:00');

    expect(result.date).toBe('2026-08-10');
    expect(result.startAt).toBe('2026-08-09T21:30:00.000Z');
  });
});

describe('utcIsoToLocalClock', () => {
  it('shows a UTC instant as Asia/Jerusalem clock time', () => {
    expect(utcIsoToLocalClock('2026-08-10T11:00:00.000Z')).toEqual({
      date: '2026-08-10',
      time: '14:00',
    });
  });
});

describe('addLocalDay', () => {
  it('steps a YYYY-MM-DD calendar date forward one day', () => {
    expect(addLocalDay('2026-08-31')).toBe('2026-09-01');
  });
});
