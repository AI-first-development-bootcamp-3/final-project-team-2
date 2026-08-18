export interface HistoricalTimeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
  description?: string | null;
  taskId: string;
  taskName: string;
  projectName: string;
  clientName: string;
  taskStatus?: 'OPEN' | 'CLOSED' | 'open' | 'closed';
  taskDeletedAt?: string | null;
}

export interface HistoricalEntriesProps {
  entries: HistoricalTimeEntry[];
}

export function HistoricalEntries({ entries }: HistoricalEntriesProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">אין דיווחי שעות היסטוריים להצגה</p>;
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <h3 className="text-base font-semibold text-neutral-900">היסטוריית דיווחי שעות</h3>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-900">{entry.taskName}</span>
              <span className="text-sm font-bold text-neutral-700">{entry.hours} שעות</span>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span>
                {entry.projectName} • {entry.clientName}
              </span>
              <span>{entry.date}</span>
            </div>
            {entry.description ? (
              <p className="mt-1 text-xs text-neutral-500">{entry.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
