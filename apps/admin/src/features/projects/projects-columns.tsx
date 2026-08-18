import type { ProjectListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

export function createProjectsColumns(params: {
  onEdit: (project: ProjectListItem) => void;
  onRemove: (project: ProjectListItem) => void;
  onViewTasks: (project: ProjectListItem) => void;
  onAddTask?: (project: ProjectListItem) => void;
}): DataTableColumn<ProjectListItem>[] {
  return [
    {
      id: 'name',
      header: 'שם',
      sortable: true,
      cell: (row) => (
        <span className={row.isDeleted ? 'text-neutral-500' : undefined}>{row.name}</span>
      ),
    },
    {
      id: 'clientName',
      header: 'לקוח',
      sortable: true,
      cell: (row) => (
        <span className={row.isDeleted ? 'text-neutral-500' : undefined}>{row.clientName}</span>
      ),
    },
    {
      id: 'isActive',
      header: 'סטטוס',
      sortable: true,
      cell: (row) =>
        row.isDeleted ? (
          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            הוסר
          </span>
        ) : (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              row.isActive ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-600'
            }`}
          >
            {row.isActive ? 'פעיל' : 'לא פעיל'}
          </span>
        ),
    },
    {
      id: 'actions',
      header: 'פעולות',
      sortable: false,
      cell: (row) =>
        row.isDeleted ? null : (
          <div className="flex items-center gap-2">
            {params.onAddTask ? (
              <button
                type="button"
                onClick={() => params.onAddTask!(row)}
                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                + הוספת משימה
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => params.onViewTasks(row)}
              className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              משימות
            </button>
            <button
              type="button"
              onClick={() => params.onEdit(row)}
              className="rounded border px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              ערוך
            </button>
            <button
              type="button"
              onClick={() => params.onRemove(row)}
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              מחיקה
            </button>
          </div>
        ),
    },
  ];
}
