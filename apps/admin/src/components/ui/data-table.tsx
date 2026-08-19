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

  // Figma table card (node 1-32935): navy header row with white labels, white
  // body rows with hairline separators, centered numbered pagination.
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-neutral-200/60">
        <table className="w-full border-collapse text-right">
          <thead className="bg-navy">
            <tr>
              {columns.map((column) => {
                const isActive = sort === column.id;
                const nextOrder: SortOrder = isActive && order === 'asc' ? 'desc' : 'asc';
                return (
                  <th key={column.id} className="px-4 py-3 text-sm font-semibold text-white">
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
              <tr
                key={getRowId(row)}
                className="border-t border-neutral-100 transition-colors hover:bg-neutral-50"
              >
                {columns.map((column) => (
                  <td key={column.id} className="px-4 py-3 text-sm">
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm text-neutral-500">
        <span>
          עמוד {page} מתוך {pageCount} ({total} רשומות)
        </span>
        <nav aria-label="עימוד" className="flex items-center gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
          >
            הקודם
          </button>
          {buildPageItems(page, pageCount).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  'min-w-8 rounded px-2 py-1 text-center hover:bg-neutral-200',
                  item === page && 'bg-neutral-200 font-semibold text-neutral-900',
                )}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-neutral-200 disabled:opacity-40"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
          >
            הבא
          </button>
        </nav>
        <span aria-hidden="true" />
      </div>
    </div>
  );
}

// Windowed page list per the Figma pagination (1 2 3 4 5 … 12): first and last
// pages always visible, a window around the current page, gaps collapsed.
function buildPageItems(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (page >= pageCount - 2)
    [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  for (const p of sorted) {
    const prev = items[items.length - 1];
    if (typeof prev === 'number' && p - prev > 1) items.push('gap');
    items.push(p);
  }
  return items;
}
