import { describe, it, expect } from 'vitest';
import {
  computeDayStatus,
  minutesForDay,
  isCoveredByAbsence,
  FULL_DAY_MINUTES,
  DayStatus,
  type DayStatusEntry,
} from './day-status.js';

const DAY = '2026-08-10';
const NEXT_DAY = '2026-08-11';

/**
 * Israel is UTC+3 in August, so a local clock time maps to an instant three
 * hours earlier. Building fixtures through this keeps the tests readable in
 * the employee's own timezone.
 */
function local(date: string, time: string): string {
  return `${date}T${time}:00.000+03:00`;
}

function entry(startLocal: string, endLocal: string | null, date = DAY): DayStatusEntry {
  return {
    startAt: local(date, startLocal),
    endAt: endLocal === null ? null : local(date, endLocal),
  };
}

describe('FULL_DAY_MINUTES', () => {
  it('is nine hours expressed in whole minutes', () => {
    expect(FULL_DAY_MINUTES).toBe(540);
  });
});

describe('computeDayStatus — hour boundaries', () => {
  it('reports an empty day when there are no entries', () => {
    const result = computeDayStatus({ date: DAY, entries: [] });
    expect(result.status).toBe('empty');
    expect(result.totalMinutes).toBe(0);
    expect(result.totalHours).toBe(0);
  });

  it('reports partial below nine hours', () => {
    const result = computeDayStatus({ date: DAY, entries: [entry('09:00', '15:00')] });
    expect(result.status).toBe('partial');
    expect(result.totalHours).toBe(6);
  });

  it('reports full at exactly nine hours', () => {
    const result = computeDayStatus({ date: DAY, entries: [entry('09:00', '18:00')] });
    expect(result.status).toBe('full');
    expect(result.totalMinutes).toBe(FULL_DAY_MINUTES);
  });

  it('reports excess above nine hours', () => {
    const result = computeDayStatus({ date: DAY, entries: [entry('09:00', '19:00')] });
    expect(result.status).toBe('excess');
    expect(result.totalHours).toBe(10);
  });

  it('separates 8h59 and 9h01 without either becoming full', () => {
    const justUnder = computeDayStatus({ date: DAY, entries: [entry('09:00', '17:59')] });
    const justOver = computeDayStatus({ date: DAY, entries: [entry('09:00', '18:01')] });

    expect(justUnder.status).toBe('partial');
    expect(justUnder.totalMinutes).toBe(539);
    expect(justOver.status).toBe('excess');
    expect(justOver.totalMinutes).toBe(541);
  });

  it('reaches full by summing several entries, where fractional hours would not', () => {
    // 2.5h + 6.5h is exactly nine hours but is not reliably 9.0 in floating point.
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('08:00', '10:30'), entry('11:00', '17:30')],
    });
    expect(result.status).toBe('full');
    expect(result.totalMinutes).toBe(FULL_DAY_MINUTES);
  });

  it('sums multiple entries on the same day', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '12:00'), entry('13:00', '17:00')],
    });
    expect(result.totalHours).toBe(7);
    expect(result.status).toBe('partial');
  });
});

describe('computeDayStatus — absences', () => {
  const absence = { startDate: DAY, endDate: DAY };

  it('reports absence rather than empty when the day is covered and unworked', () => {
    const result = computeDayStatus({ date: DAY, entries: [], absences: [absence] });
    expect(result.status).toBe('absence');
    expect(result.totalHours).toBe(0);
  });

  it('reports absence but still totals the hours when the day was partly worked', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '13:00')],
      absences: [absence],
    });
    expect(result.status).toBe('absence');
    expect(result.totalHours).toBe(4);
  });

  it('never returns absence when no absences are supplied', () => {
    expect(computeDayStatus({ date: DAY, entries: [], absences: [] }).status).toBe('empty');
    expect(computeDayStatus({ date: DAY, entries: [] }).status).toBe('empty');
  });

  it('ignores an absence that does not cover the day', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [],
      absences: [{ startDate: '2026-08-01', endDate: '2026-08-05' }],
    });
    expect(result.status).toBe('empty');
  });

  it('treats a multi-day absence range as inclusive of both bounds', () => {
    const range = [{ startDate: '2026-08-10', endDate: '2026-08-12' }];
    expect(isCoveredByAbsence(range, '2026-08-10')).toBe(true);
    expect(isCoveredByAbsence(range, '2026-08-11')).toBe(true);
    expect(isCoveredByAbsence(range, '2026-08-12')).toBe(true);
    expect(isCoveredByAbsence(range, '2026-08-09')).toBe(false);
    expect(isCoveredByAbsence(range, '2026-08-13')).toBe(false);
  });
});

describe('computeDayStatus — midnight crossing', () => {
  // 22:00 on the 10th to 06:00 on the 11th, local time.
  const nightShift: DayStatusEntry = {
    startAt: local(DAY, '22:00'),
    endAt: local(NEXT_DAY, '06:00'),
  };

  it('counts the whole night shift on the day it started', () => {
    expect(minutesForDay([nightShift], DAY)).toBe(8 * 60);
  });

  it('counts nothing of it on the day it ended', () => {
    expect(minutesForDay([nightShift], NEXT_DAY)).toBe(0);
  });

  it('makes the start day partial and leaves the end day empty', () => {
    expect(computeDayStatus({ date: DAY, entries: [nightShift] }).status).toBe('partial');
    expect(computeDayStatus({ date: NEXT_DAY, entries: [nightShift] }).status).toBe('empty');
  });

  it('lets a night shift complete a nine-hour day on its start date', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '10:00'), nightShift],
    });
    expect(result.status).toBe('full');
  });
});

describe('computeDayStatus — local-date bucketing', () => {
  it('attributes an entry by its Asia/Jerusalem date, not its UTC date', () => {
    // 22:30Z on the 10th is 01:30 on the 11th in Israel.
    const lateEntry: DayStatusEntry = {
      startAt: '2026-08-10T22:30:00Z',
      endAt: '2026-08-11T02:30:00Z',
    };

    expect(minutesForDay([lateEntry], DAY)).toBe(0);
    expect(minutesForDay([lateEntry], NEXT_DAY)).toBe(4 * 60);
  });

  it('buckets entries either side of the spring-forward without loss', () => {
    const before: DayStatusEntry = {
      startAt: '2026-03-26T18:00:00Z', // 20:00 local on the 26th (UTC+2)
      endAt: '2026-03-26T21:00:00Z',
    };
    const after: DayStatusEntry = {
      startAt: '2026-03-27T06:00:00Z', // 09:00 local on the 27th (UTC+3)
      endAt: '2026-03-27T10:00:00Z',
    };

    expect(minutesForDay([before, after], '2026-03-26')).toBe(3 * 60);
    expect(minutesForDay([before, after], '2026-03-27')).toBe(4 * 60);
  });

  it('buckets both halves of the repeated autumn hour onto the same day', () => {
    const firstPass: DayStatusEntry = {
      startAt: '2026-10-24T22:00:00Z', // 01:00 local, UTC+3
      endAt: '2026-10-24T23:00:00Z',
    };
    const secondPass: DayStatusEntry = {
      startAt: '2026-10-24T23:00:00Z', // 01:00 local again, UTC+2
      endAt: '2026-10-25T00:00:00Z',
    };

    expect(minutesForDay([firstPass, secondPass], '2026-10-25')).toBe(2 * 60);
    expect(minutesForDay([firstPass, secondPass], '2026-10-24')).toBe(0);
  });
});

describe('computeDayStatus — running entries', () => {
  it('treats a day holding only a running entry as empty', () => {
    const result = computeDayStatus({ date: DAY, entries: [entry('09:00', null)] });
    expect(result.status).toBe('empty');
    expect(result.totalMinutes).toBe(0);
  });

  it('ignores an omitted end time as well as an explicit null', () => {
    const result = computeDayStatus({ date: DAY, entries: [{ startAt: local(DAY, '09:00') }] });
    expect(result.status).toBe('empty');
  });

  it('counts completed work alongside a running entry', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('08:00', '13:00'), entry('14:00', null)],
    });
    expect(result.status).toBe('partial');
    expect(result.totalHours).toBe(5);
  });
});

describe('computeDayStatus — input tolerance', () => {
  it('accepts Date objects as well as ISO strings', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [{ startAt: new Date(local(DAY, '09:00')), endAt: new Date(local(DAY, '18:00')) }],
    });
    expect(result.status).toBe('full');
  });

  it('contributes nothing for a non-positive duration rather than going negative', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('12:00', '12:00'), entry('09:00', '12:00')],
    });
    expect(result.totalHours).toBe(3);
  });
});

describe('DayStatus enum', () => {
  it('holds exactly the five statuses the specs define', () => {
    expect(DayStatus.options).toEqual(['empty', 'partial', 'full', 'excess', 'absence']);
  });
});
