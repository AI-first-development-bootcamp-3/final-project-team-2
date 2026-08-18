import type { ClientListItem } from '@abra/contracts';
import type { DataTableColumn } from '@/components/ui/data-table';

export function createClientsColumns(params: {
  onEdit: (client: ClientListItem) => void;
  onDeactivate: (client: ClientListItem) => void;
}): DataTableColumn<ClientListItem>[] {
  return [
    {
      id: 'name',
      header: 'שם',
      sortable: true,
      cell: (row) => row.name,
    },
    {
      id: 'contactInfo',
      header: 'פרטי קשר',
      sortable: false,
      cell: (row) => row.contactInfo ?? '—',
    },
    {
      id: 'isActive',
      header: 'סטטוס',
      sortable: true,
      cell: (row) => (
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
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => params.onEdit(row)}
            className="rounded border px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            ערוך
          </button>
          {row.isActive ? (
            <button
              type="button"
              onClick={() => params.onDeactivate(row)}
              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              השבת
            </button>
          ) : null}
        </div>
      ),
    },
  ];
}
