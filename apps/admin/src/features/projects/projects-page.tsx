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
import { apiFetch } from '@/lib/api/client';
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
      }),
    [navigate],
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">פרויקטים</h2>
        <button
          type="button"
          className="rounded border bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-800"
          onClick={() => setCreateOpen(true)}
        >
          פרויקט חדש
        </button>
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
        <label className="flex flex-col text-sm">
          חיפוש
          <input
            type="search"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          לקוח
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            <option value="">כל הלקוחות</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          סטטוס
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
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
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
          />
          כולל מוסרים
        </label>
      </div>

      {loading ? <p>טוען…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result && result.data.length === 0 ? <p>אין מידע קיים עד כה</p> : null}
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

      {removingProject ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" dir="rtl">
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
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
                disabled={removing}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRemove();
                }}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
