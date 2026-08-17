import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserListItem, UsersListQuery, UsersListSuccess } from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { apiFetch } from '@/lib/api/client';
import { EditUserModal } from './edit-user-modal';
import { ResetPasswordModal } from './reset-password-modal';
import { createUsersColumns } from './users-columns';

const PAGE_SIZE = 20;

function buildUsersPath(params: {
  page: number;
  sort: UsersListQuery['sort'];
  order: SortOrder;
  q: string;
  role: string;
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
  if (params.role) search.set('role', params.role);
  if (params.isActive) search.set('isActive', params.isActive);
  if (params.includeDeleted) search.set('includeDeleted', 'true');
  return `/users?${search.toString()}`;
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<UsersListQuery['sort']>('fullName');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [result, setResult] = useState<UsersListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const path = useMemo(
    () => buildUsersPath({ page, sort, order, q, role, isActive, includeDeleted }),
    [page, sort, order, q, role, isActive, includeDeleted],
  );

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<UsersListSuccess>(path)
      .then((data) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          return;
        }
        setError('שגיאה בטעינת המשתמשים');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onSortChange = useCallback((nextSort: string, nextOrder: SortOrder) => {
    setSort(nextSort as UsersListQuery['sort']);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const columns = useMemo(
    () =>
      createUsersColumns({
        onEdit: (user) => setEditingUser(user),
        onResetPassword: (user) => setResettingPasswordUser(user),
      }),
    [],
  );

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">משתמשים</h2>

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
        <label className="flex flex-col text-sm">
          חיפוש
          <input
            type="search"
            value={q}
            onChange={(event) => onSearchChange(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          תפקיד
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            <option value="">הכל</option>
            <option value="admin">אדמין</option>
            <option value="employee">משתמש רגיל</option>
          </select>
        </label>
        <label className="flex flex-col text-sm">
          סטטוס
          <select
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
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
            onChange={(event) => {
              setIncludeDeleted(event.target.checked);
              setPage(1);
            }}
          />
          כולל מושבתים
        </label>
      </div>

      {loading ? <p>טוען…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result && result.data.length === 0 ? <p>לא נמצאו משתמשים</p> : null}
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

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setSuccessMessage('פרטי המשתמש עודכנו בהצלחה');
            fetchUsers();
          }}
        />
      ) : null}

      {resettingPasswordUser ? (
        <ResetPasswordModal
          user={resettingPasswordUser}
          onClose={() => setResettingPasswordUser(null)}
          onSuccess={() => {
            setSuccessMessage('הסיסמה שונתה בהצלחה');
            fetchUsers();
          }}
        />
      ) : null}
    </section>
  );
}
