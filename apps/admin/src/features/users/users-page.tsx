import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserListItem, UsersListQuery, UsersListSuccess } from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterSelect, PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { DeactivateUserModal } from './deactivate-user-modal';
import { EditUserModal } from './edit-user-modal';
import { ResetPasswordModal } from './reset-password-modal';
import { RestoreUserModal } from './restore-user-modal';
import { UsersCreateForm } from './users-create-form';
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
  const [deactivatingUser, setDeactivatingUser] = useState<UserListItem | null>(null);
  const [restoringUser, setRestoringUser] = useState<UserListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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
        onDeactivate: (user) => setDeactivatingUser(user),
        onRestore: (user) => setRestoringUser(user),
      }),
    [],
  );

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="משתמשים"
          subtitle="כאן תוכל לנהל את משתמשי המערכת — עריכה, איפוס סיסמה והשבתה."
        />
        <PrimaryButton onClick={() => setCreateOpen(true)}>יצירת משתמש</PrimaryButton>
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchField placeholder="חיפוש לפי שם או אימייל" value={q} onChange={onSearchChange} />
        <FilterSelect
          label="תפקיד"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">הכל</option>
          <option value="admin">אדמין</option>
          <option value="employee">משתמש רגיל</option>
        </FilterSelect>
        <FilterSelect
          label="סטטוס"
          value={isActive}
          onChange={(event) => {
            setIsActive(event.target.value);
            setPage(1);
          }}
        >
          <option value="">הכל</option>
          <option value="true">פעיל</option>
          <option value="false">לא פעיל</option>
        </FilterSelect>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
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

      {deactivatingUser ? (
        <DeactivateUserModal
          user={deactivatingUser}
          onClose={() => setDeactivatingUser(null)}
          onSuccess={() => {
            setSuccessMessage('המשתמש הושבת בהצלחה');
            fetchUsers();
          }}
        />
      ) : null}

      {restoringUser ? (
        <RestoreUserModal
          user={restoringUser}
          onClose={() => setRestoringUser(null)}
          onSuccess={() => {
            setSuccessMessage('המשתמש הופעל מחדש בהצלחה');
            fetchUsers();
          }}
        />
      ) : null}

      <UsersCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          fetchUsers();
        }}
      />
    </section>
  );
}
