import type { ProjectListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

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
          <div className="flex items-center gap-1">
            {params.onAddTask ? (
              <IconAction
                kind="plus"
                label="+ הוספת משימה"
                onClick={() => params.onAddTask!(row)}
              />
            ) : null}
            <IconAction kind="list" label="משימות" onClick={() => params.onViewTasks(row)} />
            <IconAction kind="edit" label="ערוך" onClick={() => params.onEdit(row)} />
            <IconAction kind="trash" label="מחיקה" onClick={() => params.onRemove(row)} />
          </div>
        ),
    },
  ];
}
