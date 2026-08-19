import { useEffect, useState } from 'react';
import {
  MonthQueryResponseSchema,
  toLocalDate,
  toYearMonth,
  type MonthQueryResponse,
} from '@abra/contracts';
import { authFetch } from '../../lib/api';
import { CalendarGrid } from './calendar-grid';
import { DayDetail } from './day-detail';
import { LockStatusIndicator } from './lock-status-indicator';

type MonthData = MonthQueryResponse['data'];

const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/** The month the employee is in right now, per Asia/Jerusalem (spec §3). */
function currentYearMonth(): { year: number; month: number } {
  return toYearMonth(toLocalDate(new Date()));
}

function shiftMonth(year: number, month: number, delta: 1 | -1): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  // Math.floor handles the January -> December step, where zeroBased is -1.
  return { year: year + Math.floor(zeroBased / 12), month: ((zeroBased + 12) % 12) + 1 };
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: MonthData };

/**
 * The monthly view (`/monthly`, KAN-81) — also the report history per ADR-14.
 *
 * One query per displayed month; day statuses are computed in the grid from
 * the raw entries, never fetched. Future months are navigable and simply come
 * back empty (spec §3).
 */
export function MonthlyPage() {
  const [{ year, month }, setYearMonth] = useState(currentYearMonth);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  function showMonth(next: { year: number; month: number }): void {
    setSelectedDay(null);
    setYearMonth(next);
  }

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });

    authFetch(`/months/${year}/${month}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`month query failed: ${res.status}`);
        }
        return MonthQueryResponseSchema.parse(await res.json());
      })
      .then((body) => {
        if (!cancelled) {
          setLoad({ status: 'ready', data: body.data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoad({ status: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  return (
    <div dir="rtl" className="mx-auto flex max-w-[393px] flex-col gap-4 p-4 font-sans">
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="החודש הקודם"
          onClick={() => showMonth(shiftMonth(year, month, -1))}
          className="rounded-lg px-3 py-1 text-lg font-bold text-neutral-700"
        >
          &rsaquo;
        </button>
        <h1 className="text-lg font-bold text-neutral-900">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <button
          type="button"
          aria-label="החודש הבא"
          onClick={() => showMonth(shiftMonth(year, month, 1))}
          className="rounded-lg px-3 py-1 text-lg font-bold text-neutral-700"
        >
          &lsaquo;
        </button>
      </header>

      {load.status === 'loading' && (
        <p role="status" className="py-8 text-center text-sm text-neutral-500">
          טוען…
        </p>
      )}

      {load.status === 'error' && (
        <p role="alert" className="py-8 text-center text-sm text-red-600">
          טעינת החודש נכשלה
        </p>
      )}

      {load.status === 'ready' && (
        <>
          {load.data.lock.isLocked && load.data.lock.lockedAt !== null && (
            <div className="flex flex-col gap-2">
              <LockStatusIndicator year={year} month={month} lockedAt={load.data.lock.lockedAt} />
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                החודש נעול לעריכה
              </p>
            </div>
          )}
          <CalendarGrid
            year={year}
            month={month}
            entries={load.data.entries}
            absences={load.data.absences}
            onSelectDay={setSelectedDay}
          />
          {load.data.entries.length === 0 && load.data.absences.length === 0 && (
            <p className="py-4 text-center text-sm text-neutral-500">אין דיווחים החודש</p>
          )}
          {selectedDay !== null && <DayDetail date={selectedDay} entries={load.data.entries} />}
        </>
      )}
    </div>
  );
}
