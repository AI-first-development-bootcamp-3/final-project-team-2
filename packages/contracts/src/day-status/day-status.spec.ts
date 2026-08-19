import { describe, it, expect } from 'vitest';
import {
  computeDayStatus,
  minutesForDay,
  isCoveredByAbsence,
  targetMinutesForDay,
  FULL_DAY_MINUTES,
  HALF_DAY_MINUTES,
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

describe('minutesForDay — sub-minute durations', () => {
  // Rounding each entry and summing let sub-minute dust manufacture minutes
  // that were never worked, and the exact-540 boundary is the whole point of
  // FULL_DAY_MINUTES.
  it('does not round an 8h59m30s day up to full', () => {
    const result = computeDayStatus({
      date: '2026-08-10',
      entries: [{ startAt: '2026-08-10T08:00:30.000Z', endAt: '2026-08-10T17:00:00.000Z' }],
    });

    expect(result.totalMinutes).toBe(539);
    expect(result.status).toBe('partial');
  });

  it('totals two thirty-second entries as one minute, not two', () => {
    const result = computeDayStatus({
      date: '2026-08-10',
      entries: [
        { startAt: '2026-08-10T08:00:00.000Z', endAt: '2026-08-10T08:00:30.000Z' },
        { startAt: '2026-08-10T09:00:00.000Z', endAt: '2026-08-10T09:00:30.000Z' },
      ],
    });

    expect(result.totalMinutes).toBe(1);
  });

  it('still lands exactly on full for fractional hours that sum to nine', () => {
    const result = computeDayStatus({
      date: '2026-08-10',
      entries: [
        { startAt: '2026-08-10T06:00:00.000Z', endAt: '2026-08-10T08:30:00.000Z' },
        { startAt: '2026-08-10T09:00:00.000Z', endAt: '2026-08-10T15:30:00.000Z' },
      ],
    });

    expect(result.totalMinutes).toBe(540);
    expect(result.status).toBe('full');
  });
});

describe('computeDayStatus — malformed rows degrade instead of throwing', () => {
  // These rows come from the server and the client apps never re-validate them,
  // so one bad startAt must not blank the whole quota bar from two layers down.
  it('skips an entry whose startAt cannot be parsed', () => {
    const result = computeDayStatus({
      date: '2026-08-10',
      entries: [
        { startAt: '', endAt: null },
        { startAt: '2026-08-10T06:00:00.000Z', endAt: '2026-08-10T14:00:00.000Z' },
      ],
    });

    expect(result.totalMinutes).toBe(480);
    expect(result.status).toBe('partial');
  });

  it('does not throw when every entry is malformed', () => {
    expect(() =>
      computeDayStatus({ date: '2026-08-10', entries: [{ startAt: 'garbage', endAt: 'garbage' }] }),
    ).not.toThrow();
  });
});

describe('HALF_DAY_MINUTES', () => {
  it('is four and a half hours expressed in whole minutes', () => {
    expect(HALF_DAY_MINUTES).toBe(270);
  });

  it('is exactly half a full day, so the two constants cannot drift apart', () => {
    expect(HALF_DAY_MINUTES * 2).toBe(FULL_DAY_MINUTES);
  });
});

describe('targetMinutesForDay', () => {
  const fullDay = { startDate: DAY, endDate: DAY };
  const halfDay = { startDate: DAY, endDate: DAY, isHalfDay: true };

  it('expects a full nine hours when no absence covers the day', () => {
    expect(targetMinutesForDay([], DAY)).toBe(FULL_DAY_MINUTES);
  });

  it('expects a full nine hours when an absence covers a different day', () => {
    expect(targetMinutesForDay([halfDay], NEXT_DAY)).toBe(FULL_DAY_MINUTES);
  });

  it('halves the day under a single half-day absence', () => {
    expect(targetMinutesForDay([halfDay], DAY)).toBe(HALF_DAY_MINUTES);
  });

  it('expects nothing under a full-day absence', () => {
    expect(targetMinutesForDay([fullDay], DAY)).toBe(0);
  });

  it('reads a missing isHalfDay as a full day, so existing rows keep their meaning', () => {
    expect(targetMinutesForDay([{ startDate: DAY, endDate: DAY }], DAY)).toBe(0);
    expect(targetMinutesForDay([{ startDate: DAY, endDate: DAY, isHalfDay: false }], DAY)).toBe(0);
  });

  it('expects nothing when two half-days together account for the whole day', () => {
    expect(targetMinutesForDay([halfDay, halfDay], DAY)).toBe(0);
  });

  it('lets a full-day absence outrank a half-day one on the same date', () => {
    expect(targetMinutesForDay([halfDay, fullDay], DAY)).toBe(0);
    expect(targetMinutesForDay([fullDay, halfDay], DAY)).toBe(0);
  });

  it('halves only the covered days of a half-day range', () => {
    const range = [{ startDate: '2026-08-10', endDate: '2026-08-11', isHalfDay: true }];
    expect(targetMinutesForDay(range, '2026-08-09')).toBe(FULL_DAY_MINUTES);
    expect(targetMinutesForDay(range, '2026-08-10')).toBe(HALF_DAY_MINUTES);
    expect(targetMinutesForDay(range, '2026-08-11')).toBe(HALF_DAY_MINUTES);
    expect(targetMinutesForDay(range, '2026-08-12')).toBe(FULL_DAY_MINUTES);
  });
});

describe('computeDayStatus — half-day absences', () => {
  const halfDay = { startDate: DAY, endDate: DAY, isHalfDay: true };

  // The whole point of D3: a half-day must not read as settled, or the employee
  // is never prompted for the 4h30 they still owe.
  it('does not claim the day, so an unworked half-day is empty rather than absence', () => {
    const result = computeDayStatus({ date: DAY, entries: [], absences: [halfDay] });
    expect(result.status).toBe('empty');
    expect(result.totalHours).toBe(0);
    expect(result.targetMinutes).toBe(HALF_DAY_MINUTES);
  });

  it('reports partial below the reduced target', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '11:00')],
      absences: [halfDay],
    });
    expect(result.status).toBe('partial');
    expect(result.totalMinutes).toBe(120);
    expect(result.targetMinutes).toBe(HALF_DAY_MINUTES);
  });

  it('reports full at exactly four and a half hours', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '13:30')],
      absences: [halfDay],
    });
    expect(result.status).toBe('full');
    expect(result.totalMinutes).toBe(HALF_DAY_MINUTES);
  });

  it('reports excess above the reduced target', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '15:00')],
      absences: [halfDay],
    });
    expect(result.status).toBe('excess');
    expect(result.totalMinutes).toBe(360);
    expect(result.targetMinutes).toBe(HALF_DAY_MINUTES);
  });

  // The reduced target has its own boundary, and it has to be as sharp as the
  // nine-hour one: 4h29 is not a finished half-day.
  it('separates 4h29 and 4h31 without either becoming full', () => {
    const under = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '13:29')],
      absences: [halfDay],
    });
    const over = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '13:31')],
      absences: [halfDay],
    });

    expect(under.status).toBe('partial');
    expect(under.totalMinutes).toBe(269);
    expect(over.status).toBe('excess');
    expect(over.totalMinutes).toBe(271);
  });

  // Six hours is a full day short of nine, but a whole half-day and then some.
  it('classifies the same six hours as partial on an ordinary day and excess on a half-day', () => {
    const entries = [entry('09:00', '15:00')];
    expect(computeDayStatus({ date: DAY, entries }).status).toBe('partial');
    expect(computeDayStatus({ date: DAY, entries, absences: [halfDay] }).status).toBe('excess');
  });

  // The period a half-day falls in is not a day-status input at all — both
  // halves leave the same 4h30 owed — so two employees, one off each half, are
  // classified identically.
  it('treats a morning and an afternoon half-day the same, since neither carries a period here', () => {
    const morning = computeDayStatus({
      date: DAY,
      entries: [entry('13:00', '15:00')],
      absences: [halfDay],
    });
    const afternoon = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '11:00')],
      absences: [halfDay],
    });

    expect(morning.status).toBe('partial');
    expect(afternoon.status).toBe('partial');
    expect(morning.targetMinutes).toBe(afternoon.targetMinutes);
  });

  it('reports absence when two half-days cover the day between them', () => {
    const result = computeDayStatus({ date: DAY, entries: [], absences: [halfDay, halfDay] });
    expect(result.status).toBe('absence');
    expect(result.targetMinutes).toBe(0);
  });

  it('lets a full-day absence outrank a half-day one on the same date', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [entry('09:00', '13:00')],
      absences: [halfDay, { startDate: DAY, endDate: DAY }],
    });
    expect(result.status).toBe('absence');
    expect(result.targetMinutes).toBe(0);
    expect(result.totalHours).toBe(4);
  });
});

describe('computeDayStatus — targetMinutes is always reported', () => {
  it('reports the nine-hour target on an ordinary day', () => {
    expect(computeDayStatus({ date: DAY, entries: [] }).targetMinutes).toBe(FULL_DAY_MINUTES);
    expect(computeDayStatus({ date: DAY, entries: [entry('09:00', '18:00')] }).targetMinutes).toBe(
      FULL_DAY_MINUTES,
    );
  });

  it('reports a zero target on a full-day absence', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [],
      absences: [{ startDate: DAY, endDate: DAY }],
    });
    expect(result.status).toBe('absence');
    expect(result.targetMinutes).toBe(0);
  });

  it('reports the nine-hour target when the absences supplied cover other days', () => {
    const result = computeDayStatus({
      date: DAY,
      entries: [],
      absences: [{ startDate: '2026-08-01', endDate: '2026-08-05', isHalfDay: true }],
    });
    expect(result.targetMinutes).toBe(FULL_DAY_MINUTES);
  });
});

describe('isCoveredByAbsence — half-days still count as coverage', () => {
  // The predicate answers "is there an absence here", which a half-day is. The
  // day-off decision belongs to targetMinutesForDay, not to this.
  it('reports a half-day absence as covering its date', () => {
    expect(isCoveredByAbsence([{ startDate: DAY, endDate: DAY, isHalfDay: true }], DAY)).toBe(true);
  });
});
