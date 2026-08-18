import type { AssignmentListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

export function createAssignmentsColumns(params: {
  onRemove: (assignment: AssignmentListItem) => void;
}): DataTableColumn<AssignmentListItem>[] {
  return [
    {
      id: 'userFullName',
      header: 'שם עובד',
      sortable: true,
      cell: (row) => row.userFullName,
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => params.onRemove(row)}
            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            הסר שיוך
          </button>
        </div>
      ),
    },
  ];
}
