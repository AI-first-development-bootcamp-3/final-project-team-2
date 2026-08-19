import type { TaskListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

export function createTasksColumns(params: {
  onEdit: (task: TaskListItem) => void;
  onDeactivate: (task: TaskListItem) => void;
}): DataTableColumn<TaskListItem>[] {
  return [
    {
      id: 'name',
      header: 'שם משימה',
      sortable: true,
      cell: (row) => (
        <span className={row.status === 'closed' ? 'text-neutral-400' : undefined}>{row.name}</span>
      ),
    },
    {
      id: 'projectName',
      header: 'פרויקט',
      sortable: false,
      cell: (row) => (
        <span className={row.status === 'closed' ? 'text-neutral-400' : undefined}>
          {row.projectName}
        </span>
      ),
    },
    {
      id: 'clientName',
      header: 'לקוח',
      sortable: false,
      cell: (row) => (
        <span className={row.status === 'closed' ? 'text-neutral-400' : undefined}>
          {row.clientName}
        </span>
      ),
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
        <div className="flex items-center gap-1">
          <IconAction kind="edit" label="ערוך" onClick={() => params.onEdit(row)} />
          {row.status === 'open' ? (
            <IconAction kind="trash" label="השבת" onClick={() => params.onDeactivate(row)} />
          ) : null}
        </div>
      ),
    },
  ];
}
