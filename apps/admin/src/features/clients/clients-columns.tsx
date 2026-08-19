import type { ClientListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';
import { IconAction } from '@/components/ui/icon-action';

export function createClientsColumns(params: {
  onEdit: (client: ClientListItem) => void;
  onDeactivate: (client: ClientListItem) => void;
}): DataTableColumn<ClientListItem>[] {
  return [
    {
      id: 'name',
      header: 'שם',
      sortable: true,
      cell: (row) => (
        <span className={row.isDeleted ? 'text-neutral-400' : undefined}>{row.name}</span>
      ),
    },
    {
      id: 'contactInfo',
      header: 'פרטי קשר',
      sortable: false,
      cell: (row) => (
        <span className={row.isDeleted ? 'text-neutral-400' : undefined}>
          {row.contactInfo ?? '—'}
        </span>
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
            <IconAction kind="edit" label="ערוך" onClick={() => params.onEdit(row)} />
            {row.isActive ? (
              <IconAction kind="trash" label="השבת" onClick={() => params.onDeactivate(row)} />
            ) : null}
          </div>
        ),
    },
  ];
}
