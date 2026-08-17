import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SortOrder = 'asc' | 'desc';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  cell: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  page: number;
  limit: number;
  total: number;
  sort?: string;
  order?: SortOrder;
  onPageChange: (page: number) => void;
  onSortChange?: (sort: string, order: SortOrder) => void;
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  page,
  limit,
  total,
  sort,
  order = 'asc',
  onPageChange,
  onSortChange,
}: DataTableProps<T>) {
  const pageCount = Math.max(1, Math.ceil(total / limit) || 1);
  const canPrev = page > 1;
  const canNext = page * limit < total;

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-right">
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((column) => {
                const isActive = sort === column.id;
                const nextOrder: SortOrder = isActive && order === 'asc' ? 'desc' : 'asc';
                return (
                  <th key={column.id} className="px-3 py-2 text-sm font-semibold">
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className={cn(
                          'underline-offset-2 hover:underline',
                          isActive && 'underline',
                        )}
                        onClick={() => onSortChange(column.id, nextOrder)}
                        aria-label={`מיון לפי ${column.header}`}
                      >
                        {column.header}
                        {isActive ? (order === 'asc' ? ' ↑' : ' ↓') : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={getRowId(row)} className="border-t">
                {columns.map((column) => (
                  <td key={column.id} className="px-3 py-2 text-sm">
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span>
          עמוד {page} מתוך {pageCount} ({total} רשומות)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-3 py-1 disabled:opacity-50"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
          >
            הקודם
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1 disabled:opacity-50"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
