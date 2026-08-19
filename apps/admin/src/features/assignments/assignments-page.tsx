import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AssignmentListItem,
  AssignmentsListSuccess,
  TaskListItem,
  TasksListSuccess,
  UserListItem,
  UsersListSuccess,
} from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { AssignmentCreateForm } from './assignment-create-form';
import { createAssignmentsColumns } from './assignments-columns';

const PAGE_SIZE = 20;

function buildAssignmentsPath(params: {
  page: number;
  sort: string;
  order: SortOrder;
  q: string;
  userId: string;
  taskId: string;
}): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
    sort: params.sort,
    order: params.order,
  });
  const trimmed = params.q.trim();
  if (trimmed) search.set('q', trimmed);
  if (params.userId) search.set('userId', params.userId);
  if (params.taskId) search.set('taskId', params.taskId);
  return `/assignments?${search.toString()}`;
}

export function AssignmentsPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>('userFullName');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [result, setResult] = useState<AssignmentsListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [removingAssignment, setRemovingAssignment] = useState<AssignmentListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UsersListSuccess>('/users?limit=100')
      .then((res) => setUsers(res.data))
      .catch(() => {});

    apiFetch<TasksListSuccess>('/tasks?limit=100')
      .then((res) => setTasks(res.data))
      .catch(() => {});
  }, []);

  const path = useMemo(
    () => buildAssignmentsPath({ page, sort, order, q, userId, taskId }),
    [page, sort, order, q, userId, taskId],
  );

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<AssignmentsListSuccess>(path)
      .then((data) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          return;
        }
        setError('שגיאה בטעינת השיוכים');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const onSortChange = useCallback((nextSort: string, nextOrder: SortOrder) => {
    setSort(nextSort);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const handleRemove = async () => {
    if (!removingAssignment) return;
    try {
      await apiFetch(`/assignments/${removingAssignment.id}`, { method: 'DELETE' });
      setSuccessMessage('השיוך הוסר בהצלחה');
      setRemovingAssignment(null);
      fetchAssignments();
    } catch {
      setError('שגיאה בהסרת השיוך');
    }
  };

  const columns = useMemo(
    () =>
      createAssignmentsColumns({
        onRemove: (assignment) => setRemovingAssignment(assignment),
      }),
    [],
  );

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="שיוכים"
          subtitle="כאן תוכל לשייך עובדים למשימות מתוך פרויקטים שונים של לקוחות."
        />
        <PrimaryButton onClick={() => setCreateOpen(true)}>שיוך חדש</PrimaryButton>
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
        <SearchField placeholder="חיפוש לפי שם עובד" value={q} onChange={onSearchChange} />
        <label className="flex flex-col text-sm">
          עובד
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            <option value="">כל העובדים</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          משימה
          <select
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            <option value="">כל המשימות</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p>טוען…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result && result.data.length === 0 ? <p>לא נמצאו שיוכים</p> : null}
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

      <AssignmentCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setSuccessMessage('השיוך נוצר בהצלחה');
          fetchAssignments();
        }}
      />

      {removingAssignment ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-lg font-bold text-red-600">הסרת שיוך</h3>
            <p className="mb-4 text-sm text-neutral-700">
              האם אתה בטוח שברצונך להסיר את השיוך של העובד{' '}
              <strong>{removingAssignment.userFullName}</strong> למשימה{' '}
              <strong>{removingAssignment.taskName}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemovingAssignment(null)}
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                הסר שיוך
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
