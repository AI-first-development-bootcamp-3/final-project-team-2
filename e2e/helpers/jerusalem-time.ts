/**
 * UTC ISO for an Asia/Jerusalem civil date + clock, matching the employee app.
 * Copied rather than imported so e2e does not depend on the mobile bundle.
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

export function formTimesToUtc(
  date: string,
  startTime: string,
  endTime: string,
): { date: string; startAt: string; endAt: string } {
  const startAt = localClockToUtcIso(date, startTime);
  const endAt = localClockToUtcIso(date, endTime);
  return { date, startAt, endAt };
}

function clockParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
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
