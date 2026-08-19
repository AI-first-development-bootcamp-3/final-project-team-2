import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AssignmentsByTaskListSuccess,
  TaskListItem,
  TasksListSuccess,
  UserListItem,
  UsersListSuccess,
} from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { AssignmentCreateForm } from './assignment-create-form';
import { createAssignmentsColumns, type RemoveTarget } from './assignments-columns';

const PAGE_SIZE = 20;

// KAN-122: the list is grouped by task on the server (groupBy=task) — one row
// per task with an employees array — so pagination and totals are already at
// the task level and match the design (Admin Web Portal Spec §4.2).
function buildAssignmentsPath(params: {
  page: number;
  order: SortOrder;
  q: string;
  userId: string;
  taskId: string;
}): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
    groupBy: 'task',
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
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [result, setResult] = useState<AssignmentsByTaskListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<RemoveTarget | null>(null);
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
    () => buildAssignmentsPath({ page, order, q, userId, taskId }),
    [page, order, q, userId, taskId],
  );

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<AssignmentsByTaskListSuccess>(path)
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

  const onSortChange = useCallback((_nextSort: string, nextOrder: SortOrder) => {
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const handleRemove = async () => {
    if (!removing) return;
    try {
      await apiFetch(`/assignments/${removing.employee.assignmentId}`, { method: 'DELETE' });
      setSuccessMessage('השיוך הוסר בהצלחה');
      setRemoving(null);
      fetchAssignments();
    } catch {
      setError('שגיאה בהסרת השיוך');
    }
  };

  const columns = useMemo(
    () =>
      createAssignmentsColumns({
        onRemove: (target) => setRemoving(target),
      }),
    [],
  );

  return (
    <section>
      <PageHeader
        title="שיוכים"
        subtitle="כאן תוכל לשייך עובדים למשימות מתוך פרויקטים שונים של לקוחות."
      />

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
        <SearchField
          className="ms-auto"
          placeholder="חיפוש לפי שם עובד"
          value={q}
          onChange={onSearchChange}
        />
        <PrimaryButton onClick={() => setCreateOpen(true)}>שיוך חדש</PrimaryButton>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          עובד
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">כל העובדים</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          משימה
          <select
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
      {!loading && !error && result && result.data.length === 0 ? <EmptyState /> : null}
      {!loading && !error && result && result.data.length > 0 ? (
        <DataTable
          columns={columns}
          data={result.data}
          getRowId={(row) => row.taskId}
          page={result.meta.page}
          limit={result.meta.limit}
          total={result.meta.total}
          sort="taskName"
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
        onSomeCreated={fetchAssignments}
      />

      {removing ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-lg font-bold text-red-600">הסרת שיוך</h3>
            <p className="mb-4 text-sm text-neutral-700">
              האם אתה בטוח שברצונך להסיר את השיוך של העובד{' '}
              <strong>{removing.employee.userFullName}</strong> למשימה{' '}
              <strong>{removing.task.taskName}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="rounded-lg bg-slate-400 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
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
