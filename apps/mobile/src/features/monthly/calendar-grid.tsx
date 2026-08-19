import { computeDayStatus, type DayStatus, type MonthQueryResponse } from '@abra/contracts';

type MonthData = MonthQueryResponse['data'];

export interface CalendarGridProps {
  year: number;
  month: number;
  entries: MonthData['entries'];
  absences: MonthData['absences'];
  /** Invoked with the `YYYY-MM-DD` local date of the tapped day. */
  onSelectDay?: (date: string) => void;
}

/** Sunday-first, matching the Israeli work week (spec §1). */
const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const STATUS_CLASSES: Record<DayStatus, string> = {
  empty: 'bg-neutral-100 text-neutral-500',
  partial: 'bg-amber-100 text-amber-800',
  full: 'bg-green-100 text-green-800',
  excess: 'bg-red-100 text-red-800',
  absence: 'bg-blue-100 text-blue-800',
};

const STATUS_LABELS: Record<DayStatus, string> = {
  empty: 'ללא דיווח',
  partial: 'חסר',
  full: 'מלא',
  excess: 'חריג',
  absence: 'היעדרות',
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toLocalDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Day-of-week (0 = Sunday) of a calendar date, independent of runtime timezone. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/**
 * The month at a glance: one cell per day, colored by its computed status.
 *
 * Statuses come from `computeDayStatus` in `@abra/contracts` — the same rules
 * the daily quota bar uses — and are never stored (§2.4). The grid itself is
 * pure: the page supplies the month's data and receives day taps.
 */
export function CalendarGrid({ year, month, entries, absences, onSelectDay }: CalendarGridProps) {
  const total = daysInMonth(year, month);
  const leadingBlanks = weekdayOf(toLocalDateString(year, month, 1));

  const days = Array.from({ length: total }, (_, index) => {
    const date = toLocalDateString(year, month, index + 1);
    const { status } = computeDayStatus({ date, entries, absences });
    return { date, day: index + 1, status };
  });

  return (
    <div role="grid" dir="rtl" aria-label="לוח חודשי" className="grid grid-cols-7 gap-1">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          role="columnheader"
          className="py-1 text-center text-xs font-semibold text-neutral-600"
        >
          {label}
        </div>
      ))}
      {Array.from({ length: leadingBlanks }, (_, index) => (
        <div key={`blank-${index}`} aria-hidden="true" />
      ))}
      {days.map(({ date, day, status }) => (
        <button
          key={date}
          type="button"
          role="gridcell"
          data-testid={`day-${date}`}
          data-status={status}
          aria-label={`${day} — ${STATUS_LABELS[status]}`}
          onClick={() => onSelectDay?.(date)}
          className={`aspect-square rounded-lg text-sm font-medium ${STATUS_CLASSES[status]}`}
        >
          {day}
        </button>
      ))}
    </div>
  );
}
