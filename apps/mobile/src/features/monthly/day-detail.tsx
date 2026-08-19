import { Link } from 'react-router-dom';
import type { MonthQueryResponse } from '@abra/contracts';

type MonthEntries = MonthQueryResponse['data']['entries'];

export interface DayDetailProps {
  /** `YYYY-MM-DD` local day being inspected. */
  date: string;
  /** The whole month's entries; the component picks the day's own. */
  entries: MonthEntries;
  /** A locked month is read-only (§7.1): no edit affordances. */
  locked?: boolean;
}

/**
 * Wall-clock time in Asia/Jerusalem, whatever timezone the device is in. The
 * locale only shapes the digits, so en-GB is used for its stable HH:mm.
 */
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
});

const LOCATION_LABELS: Record<string, string> = {
  office: 'משרד',
  client_site: 'אתר לקוח',
  home: 'בית',
};

function localTime(instant: string): string {
  return timeFormat.format(new Date(instant));
}

/** Whole minutes between two instants, floored the way day totals are. */
function durationHoursLabel(startAt: string, endAt: string): string {
  const minutes = Math.floor((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
  const hours = minutes / 60;
  const rounded = Number.isInteger(hours) ? hours : Number(hours.toFixed(2));
  return `${rounded} שעות`;
}

/**
 * One day's entries, drilled into from the calendar (KAN-82).
 *
 * Membership is the stored `date` column — the entry's local start day
 * (VAL-38) — so a midnight-crossing entry appears here on the day it began and
 * nowhere else. Names arrive denormalised (§8.3): a deleted client, project,
 * or task still renders by name.
 *
 * Each entry links to the standard edit form at `/entry/:id` (KAN-82's
 * round-trip); the monthly page refetches its month on return, so a saved
 * edit is reflected in the calendar without a manual refresh.
 */
export function DayDetail({ date, entries, locked = false }: DayDetailProps) {
  const dayEntries = entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <section aria-label={`דיווחי ${date}`} className="flex flex-col gap-2" dir="rtl">
      <h2 className="text-base font-semibold text-neutral-900">{date}</h2>
      {dayEntries.length === 0 ? (
        <p className="text-sm text-neutral-500">אין דיווחים ביום זה</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dayEntries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                <span>
                  {entry.endAt === null
                    ? `${localTime(entry.startAt)}–`
                    : `${localTime(entry.startAt)}–${localTime(entry.endAt)}`}
                </span>
                {entry.endAt !== null && (
                  <span>{durationHoursLabel(entry.startAt, entry.endAt)}</span>
                )}
              </div>
              <div className="text-xs text-neutral-600">
                {[entry.taskName, entry.projectName, entry.clientName]
                  .filter((name) => name !== null)
                  .join(' • ')}
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{entry.location === null ? '' : LOCATION_LABELS[entry.location]}</span>
                {!locked && (
                  <Link to={`/entry/${entry.id}`} className="text-xs font-medium text-blue-600">
                    עריכה
                  </Link>
                )}
              </div>
              {entry.description !== null && entry.description !== '' && (
                <p className="text-xs text-neutral-500">{entry.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
