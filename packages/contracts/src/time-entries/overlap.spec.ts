import { describe, it, expect } from 'vitest';
import {
  intervalsOverlap,
  findOverlap,
  OVERLAP_CANDIDATE_WINDOW_DAYS,
  type TimeInterval,
} from './overlap.js';

/** Israel is UTC+3 in August, so local clock times read naturally here. */
function at(date: string, time: string): string {
  return `${date}T${time}:00.000+03:00`;
}

function span(startDate: string, start: string, endDate: string, end: string): TimeInterval {
  return { startAt: at(startDate, start), endAt: at(endDate, end) };
}

const DAY = '2026-08-10';
const NEXT = '2026-08-11';

/** The reference entry every case below is compared against: 09:00-12:00. */
const morning = span(DAY, '09:00', DAY, '12:00');

describe('intervalsOverlap — same-day matrix', () => {
  it('detects a partial overlap on the right', () => {
    expect(intervalsOverlap(span(DAY, '11:00', DAY, '13:00'), morning)).toBe(true);
  });

  it('detects a partial overlap on the left', () => {
    expect(intervalsOverlap(span(DAY, '08:00', DAY, '10:00'), morning)).toBe(true);
  });

  it('detects a candidate fully contained in an existing entry', () => {
    expect(intervalsOverlap(span(DAY, '10:00', DAY, '11:00'), morning)).toBe(true);
  });

  it('detects a candidate fully containing an existing entry', () => {
    expect(intervalsOverlap(span(DAY, '08:00', DAY, '18:00'), morning)).toBe(true);
  });

  it('detects an exact duplicate', () => {
    expect(intervalsOverlap(span(DAY, '09:00', DAY, '12:00'), morning)).toBe(true);
  });

  it('allows an entry starting exactly where another ended', () => {
    expect(intervalsOverlap(span(DAY, '12:00', DAY, '14:00'), morning)).toBe(false);
  });

  it('allows an entry ending exactly where another began', () => {
    expect(intervalsOverlap(span(DAY, '07:00', DAY, '09:00'), morning)).toBe(false);
  });

  it('allows a clearly separate entry', () => {
    expect(intervalsOverlap(span(DAY, '13:00', DAY, '17:00'), morning)).toBe(false);
  });

  it('is symmetric', () => {
    const candidate = span(DAY, '11:00', DAY, '13:00');
    expect(intervalsOverlap(candidate, morning)).toBe(intervalsOverlap(morning, candidate));
  });
});

describe('intervalsOverlap — night shifts', () => {
  // 22:00 on the 10th to 06:00 on the 11th.
  const nightShift = span(DAY, '22:00', NEXT, '06:00');
  // 05:00 to 07:00 on the 11th, biting into the tail of the night shift.
  const earlyMorning = span(NEXT, '05:00', NEXT, '07:00');

  it('detects a morning entry colliding with the previous night shift', () => {
    expect(intervalsOverlap(earlyMorning, nightShift)).toBe(true);
  });

  it('detects it in the other insertion order too', () => {
    expect(intervalsOverlap(nightShift, earlyMorning)).toBe(true);
  });

  it('allows a morning entry that starts when the night shift ended', () => {
    expect(intervalsOverlap(span(NEXT, '06:00', NEXT, '09:00'), nightShift)).toBe(false);
  });

  it('allows an evening entry that ends when the night shift began', () => {
    expect(intervalsOverlap(span(DAY, '18:00', DAY, '22:00'), nightShift)).toBe(false);
  });

  it('detects two overlapping night shifts on consecutive days', () => {
    const previousNight = span('2026-08-09', '23:00', DAY, '07:00');
    const thisNight = span(DAY, '06:00', DAY, '14:00');
    expect(intervalsOverlap(thisNight, previousNight)).toBe(true);
  });
});

describe('intervalsOverlap — running entries', () => {
  it('never overlaps when the candidate is still running', () => {
    expect(intervalsOverlap({ startAt: at(DAY, '10:00') }, morning)).toBe(false);
  });

  it('never overlaps when the existing entry is still running', () => {
    expect(intervalsOverlap(morning, { startAt: at(DAY, '10:00'), endAt: null })).toBe(false);
  });
});

describe('intervalsOverlap — robustness', () => {
  it('returns false rather than throwing on an unparseable instant', () => {
    expect(intervalsOverlap({ startAt: 'nonsense', endAt: 'rubbish' }, morning)).toBe(false);
  });

  it('accepts Date objects as well as ISO strings', () => {
    const candidate = {
      startAt: new Date(at(DAY, '11:00')),
      endAt: new Date(at(DAY, '13:00')),
    };
    expect(intervalsOverlap(candidate, morning)).toBe(true);
  });
});

describe('findOverlap', () => {
  const existing = [span(DAY, '09:00', DAY, '12:00'), span(DAY, '13:00', DAY, '17:00')];

  it('returns the colliding entry so the caller can name it', () => {
    const hit = findOverlap(span(DAY, '16:00', DAY, '18:00'), existing);
    expect(hit).toBe(existing[1]);
  });

  it('returns undefined when the candidate fits in the gap', () => {
    expect(findOverlap(span(DAY, '12:00', DAY, '13:00'), existing)).toBeUndefined();
  });

  it('returns undefined against an empty set', () => {
    expect(findOverlap(morning, [])).toBeUndefined();
  });
});

describe('OVERLAP_CANDIDATE_WINDOW_DAYS', () => {
  it('is wide enough for any entry up to 24 hours', () => {
    // The query filters on an existing entry's start, so the window must reach
    // back at least one full day to catch a night shift begun the evening
    // before. This asserts the documented bound (task 5.4).
    expect(OVERLAP_CANDIDATE_WINDOW_DAYS).toBeGreaterThanOrEqual(1);

    const windowMs = OVERLAP_CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const longestSupportedEntryMs = 24 * 60 * 60 * 1000;
    expect(windowMs).toBeGreaterThanOrEqual(longestSupportedEntryMs);
  });
});
