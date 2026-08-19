import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ClientListItem,
  ClientsListSuccess,
  ProjectListItem,
  ProjectsListQuery,
  ProjectsListSuccess,
} from '@abra/contracts';
import { DataTable, type SortOrder } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton, SearchField } from '@/components/ui/toolbar';
import { apiFetch } from '@/lib/api/client';
import { TaskCreateForm } from '@/features/tasks/task-create-form';
import { ProjectCreateForm } from './project-create-form';
import { ProjectEditModal } from './project-edit-modal';
import { createProjectsColumns } from './projects-columns';

const PAGE_SIZE = 20;

function buildProjectsPath(params: {
  page: number;
  sort: ProjectsListQuery['sort'];
  order: SortOrder;
  q: string;
  clientId: string;
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
  if (params.clientId) search.set('clientId', params.clientId);
  if (params.isActive) search.set('isActive', params.isActive);
  if (params.includeDeleted) search.set('includeDeleted', 'true');
  return `/projects?${search.toString()}`;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProjectsListQuery['sort']>('name');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState('');
  const [isActive, setIsActive] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [result, setResult] = useState<ProjectsListSuccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [removingProject, setRemovingProject] = useState<ProjectListItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [addingTaskProject, setAddingTaskProject] = useState<ProjectListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const removingRef = useRef(false);

  useEffect(() => {
    apiFetch<ClientsListSuccess>('/clients?limit=100')
      .then((res) => setClients(res.data))
      .catch(() => {});
  }, []);

  const path = useMemo(
    () => buildProjectsPath({ page, sort, order, q, clientId, isActive, includeDeleted }),
    [page, sort, order, q, clientId, isActive, includeDeleted],
  );

  const fetchProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<ProjectsListSuccess>(path)
      .then((data) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
          return;
        }
        setError('שגיאה בטעינת הפרויקטים');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onSortChange = useCallback((nextSort: string, nextOrder: SortOrder) => {
    setSort(nextSort as ProjectsListQuery['sort']);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const handleRemove = async () => {
    if (!removingProject || removingRef.current) return;
    removingRef.current = true;
    setRemoving(true);
    try {
      await apiFetch(`/projects/${removingProject.id}`, { method: 'DELETE' });
      setSuccessMessage('הפרויקט הוסר בהצלחה');
      setRemovingProject(null);
      fetchProjects();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
        return;
      }
      setError('לא ניתן להסיר את הפרויקט כרגע. נסו שוב.');
    } finally {
      removingRef.current = false;
      setRemoving(false);
    }
  };

  const columns = useMemo(
    () =>
      createProjectsColumns({
        onEdit: (project) => setEditingProject(project),
        onRemove: (project) => setRemovingProject(project),
        onViewTasks: (project) => navigate(`/admin/tasks?projectId=${project.id}`),
        onAddTask: (project) => setAddingTaskProject(project),
      }),
    [navigate],
  );

  return (
    <section>
      <PageHeader title="פרויקטים" subtitle="כאן תוכל לנהל את הפרויקטים של כל לקוח." />

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
          placeholder="חיפוש לפי שם פרויקט"
          value={q}
          onChange={onSearchChange}
        />
        <PrimaryButton onClick={() => setCreateOpen(true)}>פרויקט חדש</PrimaryButton>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          לקוח
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">כל הלקוחות</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
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

      <ProjectCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setSuccessMessage('הפרויקט נוצר בהצלחה');
          fetchProjects();
        }}
      />

      {editingProject ? (
        <ProjectEditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSuccess={() => {
            setEditingProject(null);
            setSuccessMessage('פרטי הפרויקט עודכנו בהצלחה');
            fetchProjects();
          }}
        />
      ) : null}

      {addingTaskProject ? (
        <TaskCreateForm
          open={true}
          defaultProjectId={addingTaskProject.id}
          onClose={() => setAddingTaskProject(null)}
          onCreated={() => {
            setAddingTaskProject(null);
            setSuccessMessage('המשימה נוצרה בהצלחה');
            fetchProjects();
          }}
        />
      ) : null}

      {removingProject ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-lg font-bold text-red-600">הסרת פרויקט</h3>
            <p className="mb-4 text-sm text-neutral-700">
              האם אתה בטוח שברצונך להסיר את הפרויקט <strong>{removingProject.name}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (removing) return;
                  setRemovingProject(null);
                }}
                className="rounded-lg bg-slate-400 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
                disabled={removing}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRemove();
                }}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                disabled={removing}
              >
                {removing ? 'מוחק…' : 'מחיקה'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
