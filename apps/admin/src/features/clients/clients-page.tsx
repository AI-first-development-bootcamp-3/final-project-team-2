import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClientListItem, ClientsListQuery, ClientsListSuccess } from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { createClientsColumns } from './clients-columns';
import { ClientCreateForm } from './client-create-form';
import { ClientEditModal } from './client-edit-modal';

const PAGE_SIZE = 20;

function buildClientsPath(params: {
  page: number;
  sort: ClientsListQuery['sort'];
  order: SortOrder;
  q: string;
  isActive: string;
  includeDeleted: boolean;
}): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
    sort: params.sort,
    order: params.order,
  });
  const trimmed = params.q.trim();
  if (trimmed) search.set('q', trimmed);
  if (params.isActive) search.set('isActive', params.isActive);
  if (params.includeDeleted) search.set('includeDeleted', 'true');
  return `/clients?${search.toString()}`;
}

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ClientsListQuery['sort']>('name');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [result, setResult] = useState<ClientsListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null);
  const [deactivatingClient, setDeactivatingClient] = useState<ClientListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const path = useMemo(
    () => buildClientsPath({ page, sort, order, q, isActive, includeDeleted }),
    [page, sort, order, q, isActive, includeDeleted],
  );

  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<ClientsListSuccess>(path)
      .then((data) => setResult(data))
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) return;
        setError('שגיאה בטעינת הלקוחות');
      })
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onSortChange = useCallback((nextSort: string, nextOrder: SortOrder) => {
    setSort(nextSort as ClientsListQuery['sort']);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const handleDeactivate = useCallback(async () => {
    if (!deactivatingClient) return;
    try {
      await apiFetch(`/clients/${deactivatingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      setSuccessMessage('הלקוח הושבת בהצלחה');
      fetchClients();
    } catch {
      setError('שגיאה בהשבתת הלקוח');
    } finally {
      setDeactivatingClient(null);
    }
  }, [deactivatingClient, fetchClients]);

  const columns = useMemo(
    () =>
      createClientsColumns({
        onEdit: (client) => setEditingClient(client),
        onDeactivate: (client) => setDeactivatingClient(client),
      }),
    [],
  );

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="לקוחות" subtitle="כאן תוכל לנהל את רשימת הלקוחות של אברא." />
        <PrimaryButton onClick={() => setCreateOpen(true)}>לקוח חדש</PrimaryButton>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded bg-green-100 p-3 text-sm text-green-800"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchField placeholder="חיפוש לפי שם לקוח" value={q} onChange={onSearchChange} />
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          סטטוס
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">הכל</option>
            <option value="true">פעיל</option>
            <option value="false">לא פעיל</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
          />
          כולל מחוקים
        </label>
      </div>

      {loading ? <p>טוען…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result && result.data.length === 0 ? <EmptyState /> : null}
      {!loading && !error && result && result.data.length > 0 ? (
        <DataTable
          columns={columns}
          data={result.data}
          getRowId={(row) => row.id}
          page={result.meta.page}
          limit={result.meta.limit}
          total={result.meta.total}
          sort={sort}
          order={order}
          onPageChange={setPage}
          onSortChange={onSortChange}
        />
      ) : null}

      {editingClient ? (
        <ClientEditModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={() => {
            setSuccessMessage('פרטי הלקוח עודכנו בהצלחה');
            fetchClients();
          }}
        />
      ) : null}

      {deactivatingClient ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-md border bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-red-600">השבתת לקוח</h3>
            <p className="mb-4 text-sm text-neutral-700">
              האם אתה בטוח שברצונך להשבית את הלקוח <strong>{deactivatingClient.name}</strong>?
              <br />
              <span className="text-xs text-neutral-500">
                (הלקוח לא יופיע בבחירת דיווח חדש, אך הפרויקטים והמשימות שלו לא ישתנו.)
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setDeactivatingClient(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                onClick={() => {
                  void handleDeactivate();
                }}
              >
                השבת
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ClientCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setSuccessMessage('הלקוח נוצר בהצלחה');
          fetchClients();
        }}
      />
    </section>
  );
}
