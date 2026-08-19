import { useState } from 'react';
import type { AssignedEmployee, AssignmentsByTaskItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

// KAN-122 (Admin Web Portal Spec §4.2, Figma 1-32935): one row per TASK,
// columns right→left שם לקוח · שם פרויקט · שם המשימה · שמות העובדים המשוייכים
// · פעולות, with the assigned employees rendered as tag chips.

export type RemoveTarget = {
  employee: AssignedEmployee;
  task: AssignmentsByTaskItem;
};

// Figma chip spec: bg #ECECEC (divider token), radius 4, text #212525 (ink),
// height 28px. Beyond MAX_VISIBLE_CHIPS the extras collapse into a "+N" chip
// whose title lists the remaining names on hover.
const MAX_VISIBLE_CHIPS = 4;

function EmployeeChips(props: {
  row: AssignmentsByTaskItem;
  onRemove: (target: RemoveTarget) => void;
}) {
  const visible = props.row.employees.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = props.row.employees.slice(MAX_VISIBLE_CHIPS);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((employee) => (
        <span
          key={employee.assignmentId}
          className="inline-flex h-7 items-center gap-1 rounded bg-divider px-2 text-sm text-ink"
        >
          {employee.userFullName}
          <button
            type="button"
            aria-label={`הסר שיוך: ${employee.userFullName}`}
            title={`הסר שיוך: ${employee.userFullName}`}
            onClick={() => props.onRemove({ employee, task: props.row })}
            className="rounded-sm px-0.5 text-grayIcon transition-colors hover:bg-neutral-300/60 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ))}
      {overflow.length > 0 ? (
        <span
          title={overflow.map((employee) => employee.userFullName).join(', ')}
          className="inline-flex h-7 cursor-default items-center rounded bg-divider px-2 text-sm font-medium text-ink"
        >
          +{overflow.length}
        </span>
      ) : null}
    </div>
  );
}

// Row action per the design's פעולות column. A single-employee task removes
// directly (keeps the exact 'הסר שיוך' accessible name working end to end);
// with several employees it opens a small per-employee removal menu, so even
// employees collapsed into the "+N" chip stay removable.
function RowRemoveAction(props: {
  row: AssignmentsByTaskItem;
  onRemove: (target: RemoveTarget) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    const [only] = props.row.employees;
    if (props.row.employees.length === 1 && only) {
      props.onRemove({ employee: only, task: props.row });
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <IconAction kind="unlink" label="הסר שיוך" onClick={handleClick} />
      {open ? (
        <ul
          role="menu"
          aria-label="בחר עובד להסרת שיוך"
          className="absolute left-0 top-full z-10 mt-1 min-w-40 rounded-lg border border-divider bg-white py-1 shadow-lg"
        >
          {props.row.employees.map((employee) => (
            <li key={employee.assignmentId} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  props.onRemove({ employee, task: props.row });
                }}
                className="block w-full whitespace-nowrap px-3 py-1.5 text-right text-sm text-ink hover:bg-neutral-50"
              >
                {employee.userFullName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function createAssignmentsColumns(params: {
  onRemove: (target: RemoveTarget) => void;
}): DataTableColumn<AssignmentsByTaskItem>[] {
  return [
    {
      id: 'clientName',
      header: 'שם לקוח',
      sortable: false,
      cell: (row) => row.clientName,
    },
    {
      id: 'projectName',
      header: 'שם פרויקט',
      sortable: false,
      cell: (row) => row.projectName,
    },
    {
      id: 'taskName',
      header: 'שם המשימה',
      sortable: true,
      cell: (row) => row.taskName,
    },
    {
      id: 'employees',
      header: 'שמות העובדים המשוייכים',
      sortable: false,
      cell: (row) => <EmployeeChips row={row} onRemove={params.onRemove} />,
    },
    {
      id: 'actions',
      header: 'פעולות',
      sortable: false,
      cell: (row) => <RowRemoveAction row={row} onRemove={params.onRemove} />,
    },
  ];
}
