import type { UserListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

const ROLE_LABEL: Record<UserListItem['role'], string> = {
  employee: 'משתמש רגיל',
  admin: 'אדמין',
};

export function statusLabel(user: UserListItem): string {
  return user.isActive ? 'פעיל' : 'לא פעיל';
}

export function createUsersColumns(params: {
  onEdit: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
}): DataTableColumn<UserListItem>[] {
  return [
    {
      id: 'fullName',
      header: 'שם מלא',
      sortable: true,
      cell: (row) => row.fullName,
    },
    {
      id: 'email',
      header: 'אימייל',
      sortable: true,
      cell: (row) => row.email,
    },
    {
      id: 'role',
      header: 'תפקיד',
      sortable: true,
      cell: (row) => ROLE_LABEL[row.role],
    },
    {
      id: 'isActive',
      header: 'סטטוס',
      sortable: true,
      cell: (row) => statusLabel(row),
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
          <button
            type="button"
            onClick={() => params.onResetPassword(row)}
            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            איפוס סיסמה
          </button>
        </div>
      ),
    },
  ];
}

export const usersColumns: DataTableColumn<UserListItem>[] = createUsersColumns({
  onEdit: () => {},
  onResetPassword: () => {},
});
