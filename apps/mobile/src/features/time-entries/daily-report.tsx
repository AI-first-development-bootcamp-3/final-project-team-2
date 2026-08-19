import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiErrorSchema,
  TimeEntriesListSuccessSchema,
  VAL_MESSAGES,
  toLocalDate,
  type TimeEntryListItem,
} from '@abra/contracts';
import { authFetch } from '../../lib/api';
import { utcIsoToLocalClock } from './local-clock';
import { QuotaBar } from './quota-bar';

const LOCATION_LABEL: Record<string, string> = {
  office: 'משרד',
  client_site: 'אצל לקוח',
  home: 'בית',
};

export interface DailyReportProps {
  date?: string;
  locked?: boolean;
}

function formatRange(entry: TimeEntryListItem): string {
  const start = utcIsoToLocalClock(entry.startAt).time;
  const end = entry.endAt ? utcIsoToLocalClock(entry.endAt).time : '—';
  return `${start} – ${end}`;
}

export function DailyReport({ date, locked = false }: DailyReportProps) {
  const day = date ?? toLocalDate(new Date());
  const [entries, setEntries] = useState<TimeEntryListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [monthLocked, setMonthLocked] = useState(locked);
  const [pendingDelete, setPendingDelete] = useState<TimeEntryListItem | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    setEntries(null);
    authFetch(`/time-entries?date=${day}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('failed to load');
        }
        const body = TimeEntriesListSuccessSchema.parse(await response.json());
        setEntries(body.data);
      })
      .catch(() => {
        setError(true);
        setEntries([]);
      });
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMonthLocked(locked);
  }, [locked]);

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const target = pendingDelete;
    setPendingDelete(null);
    const response = await authFetch(`/time-entries/${target.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      const parsed = ApiErrorSchema.safeParse(body);
      const details = parsed.success ? (parsed.data.details ?? []) : [];
      if (details.some((detail) => detail.rule === 'VAL-34') || response.status === 403) {
        setMonthLocked(true);
        setLockMessage(VAL_MESSAGES['VAL-34']);
      }
      return;
    }
    load();
  }

  const loading = entries === null && !error;
  const empty = entries !== null && entries.length === 0 && !error;

  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-screen w-full max-w-[393px] flex-col gap-4 bg-lightBg p-4 font-sans"
    >
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy">דיווח שעות</h1>
      </header>

      {monthLocked ? (
        <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-navy">
          החודש נעול
        </p>
      ) : null}
      {lockMessage ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {lockMessage}
        </p>
      ) : null}

      <QuotaBar date={day} entries={entries ?? []} absences={[]} />

      {loading ? <p className="text-sm text-darkGray">טוען דיווחים…</p> : null}

      {error ? (
        <div className="rounded-xl bg-white px-4 py-6 text-center">
          <p className="font-semibold text-navy">אופססס...</p>
          <p className="mt-2 text-sm text-darkGray">
            אין מידע זמין כרגע, נסה שוב מאוחר יותר או פנה למנהל ישיר
          </p>
        </div>
      ) : null}

      {empty ? <p className="text-sm text-darkGray">אין דיווחי שעות להיום</p> : null}

      {entries && entries.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 rounded-xl bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy">{entry.taskName}</span>
                <span className="text-sm text-darkGray">{formatRange(entry)}</span>
              </div>
              <p className="text-sm text-darkGray">
                <span>{entry.projectName}</span>
                {' · '}
                <span>{entry.clientName}</span>
              </p>
              {entry.location ? (
                <p className="text-sm text-darkGray">
                  {LOCATION_LABEL[entry.location] ?? entry.location}
                </p>
              ) : null}
              {entry.description ? <p className="text-sm text-navy">{entry.description}</p> : null}
              {monthLocked ? null : (
                <div className="mt-1 flex gap-3">
                  <Link to={`/entry/${entry.id}`} className="text-sm font-medium text-blue-600">
                    עריכה
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(entry)}
                    className="text-sm font-medium text-red-600"
                  >
                    מחיקה
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {monthLocked ? null : (
        <Link
          to="/entry/new"
          className="mt-auto w-full rounded-lg bg-navy py-4 text-center text-base font-semibold text-white"
        >
          דיווח ידני
        </Link>
      )}

      {pendingDelete ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-label="אישור מחיקה"
            className="w-full max-w-[393px] rounded-2xl bg-white p-6"
          >
            <p className="mb-4 text-center text-navy">למחוק את הדיווח?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-lg bg-slate-200 py-3 text-navy"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDelete();
                }}
                className="flex-1 rounded-lg bg-red-600 py-3 text-white"
              >
                מחיקה
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
