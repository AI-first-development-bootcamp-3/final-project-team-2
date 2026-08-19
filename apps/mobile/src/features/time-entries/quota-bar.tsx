import React from 'react';
import {
  computeDayStatus,
  FULL_DAY_MINUTES,
  type DayStatusAbsence,
  type DayStatusEntry,
} from '@abra/contracts';

const STATUS_CLASS: Record<string, string> = {
  empty: 'bg-slate-200',
  partial: 'bg-orange-400',
  full: 'bg-emerald-500',
  excess: 'bg-red-400',
  absence: 'bg-sky-400',
};

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export interface QuotaBarProps {
  date: string;
  entries: readonly DayStatusEntry[];
  absences?: readonly DayStatusAbsence[];
}

/**
 * Advisory quota against the shared day-status rules. Thresholds live in
 * contracts — this component never compares hours itself.
 */
export function QuotaBar({ date, entries, absences = [] }: QuotaBarProps) {
  const { status, totalMinutes } = computeDayStatus({ date, entries, absences });
  const remaining = Math.max(0, FULL_DAY_MINUTES - totalMinutes);
  const fill = Math.min(100, (totalMinutes / FULL_DAY_MINUTES) * 100);

  return (
    <div
      role="status"
      data-status={status}
      className="flex flex-col gap-2 rounded-xl bg-white px-4 py-3"
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-navy">{formatHours(totalMinutes)} מתוך 9 שעות</span>
        {status === 'partial' || status === 'empty' ? (
          <span className="text-darkGray">חסרות {formatHours(remaining)} שעות לדיווח</span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${STATUS_CLASS[status]}`} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}
