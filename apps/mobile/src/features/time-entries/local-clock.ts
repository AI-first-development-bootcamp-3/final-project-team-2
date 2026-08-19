import { APP_TIME_ZONE, toLocalDate } from '@abra/contracts';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Steps a `YYYY-MM-DD` civil date forward one calendar day.
 *
 * Uses UTC date arithmetic so the result does not depend on the host timezone.
 */
export function addLocalDay(date: string, days = 1): string {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function clockParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const find = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    date: `${find('year')}-${find('month')}-${find('day')}`,
    time: `${find('hour')}:${find('minute')}`,
  };
}

/**
 * The UTC instant whose Asia/Jerusalem clock equals `date` + `time`.
 *
 * Start from the naive UTC reading of the same numbers, then shift by the
 * difference between that instant's Jerusalem clock and the clock we want.
 * A couple of iterations cover DST: the offset depends on the instant.
 */
export function localClockToUtcIso(date: string, time: string): string {
  const wanted = Date.parse(`${date}T${time}:00.000Z`);
  let utc = wanted;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = clockParts(new Date(utc));
    const shownAsUtc = Date.parse(`${shown.date}T${shown.time}:00.000Z`);
    utc += wanted - shownAsUtc;
  }

  return new Date(utc).toISOString();
}

/**
 * Turns the local date and clock times the employee typed into the UTC
 * payload the API expects. An end time earlier on the clock than the start
 * is a night shift ending the next local day, not a backwards interval.
 */
export function formTimesToUtc(
  date: string,
  startTime: string,
  endTime: string,
): { date: string; startAt: string; endAt: string } {
  const startAt = localClockToUtcIso(date, startTime);
  const endDate = endTime < startTime ? addLocalDay(date) : date;
  const endAt = localClockToUtcIso(endDate, endTime);

  return {
    date: toLocalDate(new Date(startAt)),
    startAt,
    endAt,
  };
}

/** Asia/Jerusalem calendar date and `HH:MM` for a UTC instant. */
export function utcIsoToLocalClock(iso: string): { date: string; time: string } {
  return clockParts(new Date(iso));
}
