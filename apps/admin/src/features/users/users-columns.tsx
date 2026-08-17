import type { UserListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

const ROLE_LABEL: Record<UserListItem['role'], string> = {
  employee: 'משתמש רגיל',
  admin: 'אדמין',
};

export function statusLabel(user: UserListItem): string {
  return user.isActive ? 'פעיל' : 'לא פעיל';
}

export const usersColumns: DataTableColumn<UserListItem>[] = [
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
];
