/**
 * Overlap detection for time entries (VAL-32).
 *
 * Kept as a pure comparison so the full matrix — contained, containing,
 * partial on either side, touching, and night-shift pairs — can be driven by
 * unit tests without a database. The API is then responsible only for handing
 * it a candidate set that cannot miss a neighbour.
 */

export interface TimeInterval {
  /** UTC instant the entry started. */
  startAt: Date | string;
  /** UTC instant it ended; absent or null means still running (§8.6). */
  endAt?: Date | string | null;
}

/**
 * How far either side of a candidate interval the API must look for
 * neighbours, in days.
 *
 * The query filters on an existing entry's *start*, so a night shift that
 * began the previous evening would fall outside a naive same-day filter.
 * Widening by a day guarantees any entry up to 24 hours long is still a
 * candidate.
 *
 * Known limit: the spec sets no maximum entry duration, so an entry longer
 * than 24 hours starting more than a day before the candidate could escape
 * this window. Raise this constant if such durations ever become reachable.
 */
export const OVERLAP_CANDIDATE_WINDOW_DAYS = 1;

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/** An interval usable for comparison, or null if it is running or unparseable. */
function toBounds(interval: TimeInterval): { start: number; end: number } | null {
  if (interval.endAt === undefined || interval.endAt === null) {
    return null;
  }

  const start = toTime(interval.startAt);
  const end = toTime(interval.endAt);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return { start, end };
}

/**
 * Whether two entries occupy any of the same time.
 *
 * Strict inequalities on both sides mean entries that merely touch — 12:00
 * starting where 09:00–12:00 ended — do not count as overlapping, which is
 * what makes back-to-back reporting possible.
 *
 * A running entry has no interval to compare, so it never overlaps anything.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  const first = toBounds(a);
  const second = toBounds(b);

  if (first === null || second === null) {
    return false;
  }

  return first.start < second.end && second.start < first.end;
}

/**
 * The first existing entry the candidate collides with, or undefined when it
 * fits cleanly. Returning the offender lets the caller name it in the error.
 */
export function findOverlap<T extends TimeInterval>(
  candidate: TimeInterval,
  existing: readonly T[],
): T | undefined {
  return existing.find((entry) => intervalsOverlap(candidate, entry));
}
