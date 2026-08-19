import type { AssignmentListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

export function createAssignmentsColumns(params: {
  onRemove: (assignment: AssignmentListItem) => void;
}): DataTableColumn<AssignmentListItem>[] {
  return [
    {
      id: 'userFullName',
      header: 'שם עובד',
      sortable: true,
      cell: (row) => (
        <span className="inline-block rounded bg-divider px-3 py-1 text-sm text-ink">
          {row.userFullName}
        </span>
      ),
    },
    {
      id: 'userEmail',
      header: 'אימייל עובד',
      sortable: false,
      cell: (row) => row.userEmail,
    },
    {
      id: 'taskName',
      header: 'משימה',
      sortable: true,
      cell: (row) => row.taskName,
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
      id: 'actions',
      header: 'פעולות',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <IconAction kind="unlink" label="הסר שיוך" onClick={() => params.onRemove(row)} />
        </div>
      ),
    },
  ];
}
