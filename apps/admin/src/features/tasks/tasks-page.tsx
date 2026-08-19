import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ProjectListItem,
  ProjectsListSuccess,
  TaskListItem,
  TasksListQuery,
  TasksListSuccess,
} from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { TaskCreateForm } from './task-create-form';
import { TaskEditModal } from './task-edit-modal';
import { createTasksColumns } from './tasks-columns';

const PAGE_SIZE = 20;

function buildTasksPath(params: {
  page: number;
  sort: TasksListQuery['sort'];
  order: SortOrder;
  q: string;
  projectId: string;
  status: string;
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
  if (params.projectId) search.set('projectId', params.projectId);
  if (params.status) search.set('status', params.status);
  if (params.includeDeleted) search.set('includeDeleted', 'true');
  return `/tasks?${search.toString()}`;
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get('projectId') ?? '';

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TasksListQuery['sort']>('name');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState(urlProjectId);
  const [status, setStatus] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [result, setResult] = useState<TasksListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskListItem | null>(null);
  const [deactivatingTask, setDeactivatingTask] = useState<TaskListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(urlProjectId);
  }, [urlProjectId]);

  useEffect(() => {
    apiFetch<ProjectsListSuccess>('/projects?limit=100')
      .then((res) => setProjects(res.data))
      .catch(() => {});
  }, []);

  const path = useMemo(
    () => buildTasksPath({ page, sort, order, q, projectId, status, includeDeleted }),
    [page, sort, order, q, projectId, status, includeDeleted],
  );

  const fetchTasks = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<TasksListSuccess>(path)
      .then((data) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          return;
        }
        setError('שגיאה בטעינת המשימות');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onSortChange = useCallback((nextSort: string, nextOrder: SortOrder) => {
    setSort(nextSort as TasksListQuery['sort']);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const handleProjectFilterChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (newProjectId) {
      nextParams.set('projectId', newProjectId);
    } else {
      nextParams.delete('projectId');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleDeactivate = async () => {
    if (!deactivatingTask) return;
    try {
      await apiFetch(`/tasks/${deactivatingTask.id}`, { method: 'DELETE' });
      setSuccessMessage('המשימה הושבתה (נסגרה) בהצלחה');
      setDeactivatingTask(null);
      fetchTasks();
    } catch {
      setError('שגיאה בהשבתת המשימה');
    }
  };

  const columns = useMemo(
    () =>
      createTasksColumns({
        onEdit: (task) => setEditingTask(task),
        onDeactivate: (task) => setDeactivatingTask(task),
      }),
    [],
  );

  return (
    <section>
      <PageHeader title="משימות" subtitle="כאן תוכל לנהל את המשימות בתוך הפרויקטים." />

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
          placeholder="חיפוש לפי שם משימה"
          value={q}
          onChange={onSearchChange}
        />
        <PrimaryButton onClick={() => setCreateOpen(true)}>משימה חדשה</PrimaryButton>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          פרויקט
          <select
            value={projectId}
            onChange={(e) => handleProjectFilterChange(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">כל הפרויקטים</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.clientName})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          סטטוס
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">הכל</option>
            <option value="open">פתוחה</option>
            <option value="closed">סגורה</option>
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

      <TaskCreateForm
        open={createOpen}
        defaultProjectId={projectId || undefined}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setSuccessMessage('המשימה נוצרה בהצלחה');
          fetchTasks();
        }}
      />

      {editingTask ? (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            setEditingTask(null);
            setSuccessMessage('פרטי המשימה עודכנו בהצלחה');
            fetchTasks();
          }}
        />
      ) : null}

      {deactivatingTask ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-lg font-bold text-red-600">השבתת משימה</h3>
            <p className="mb-4 text-sm text-neutral-700">
              האם אתה בטוח שברצונך להשבית את המשימה <strong>{deactivatingTask.name}</strong>?
              <br />
              <span className="text-xs text-neutral-500">
                (המשימה תועבר לסטטוס סגור ותוסר מרשימת המשימות הפעילות.)
              </span>
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeactivatingTask(null)}
                className="rounded-lg bg-slate-400 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                השבת משימה
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
