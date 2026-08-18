import type { TaskListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

export function createTasksColumns(params: {
  onEdit: (task: TaskListItem) => void;
  onDeactivate: (task: TaskListItem) => void;
}): DataTableColumn<TaskListItem>[] {
  return [
    {
      id: 'name',
      header: 'שם משימה',
      sortable: true,
      cell: (row) => row.name,
    },
    {
      id: 'projectName',
      header: 'פרויקט',
      sortable: false,
      cell: (row) => row.projectName,
    },
    {
      id: 'clientName',
      header: 'לקוח',
      sortable: false,
      cell: (row) => row.clientName,
    },
    {
      id: 'status',
      header: 'סטטוס',
      sortable: true,
      cell: (row) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            row.status === 'open'
              ? 'bg-green-100 text-green-800'
              : 'bg-neutral-200 text-neutral-600'
          }`}
        >
          {row.status === 'open' ? 'פתוחה' : 'סגורה'}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'תיאור',
      sortable: false,
      cell: (row) => (
        <span className="inline-block max-w-[200px] truncate text-xs text-neutral-600">
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'פעולות',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => params.onEdit(row)}
            className="rounded border px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            ערוך
          </button>
          {row.status === 'open' ? (
            <button
              type="button"
              onClick={() => params.onDeactivate(row)}
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              השבת
            </button>
          ) : null}
        </div>
      ),
    },
  ];
}
