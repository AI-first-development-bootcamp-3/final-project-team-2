import type { UserListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

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
  onDeactivate: (user: UserListItem) => void;
  onRestore: (user: UserListItem) => void;
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
        <div className="flex items-center gap-1">
          <IconAction kind="edit" label="ערוך" onClick={() => params.onEdit(row)} />
          <IconAction kind="key" label="איפוס סיסמה" onClick={() => params.onResetPassword(row)} />
          {row.isActive ? (
            <IconAction kind="trash" label="השבת" onClick={() => params.onDeactivate(row)} />
          ) : (
            <IconAction kind="restore" label="הפעל מחדש" onClick={() => params.onRestore(row)} />
          )}
        </div>
      ),
    },
  ];
}

export const usersColumns: DataTableColumn<UserListItem>[] = createUsersColumns({
  onEdit: () => {},
  onResetPassword: () => {},
  onDeactivate: () => {},
  onRestore: () => {},
});
