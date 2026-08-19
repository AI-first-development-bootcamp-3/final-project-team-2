import { useEffect, useRef, useState } from 'react';
import {
  UpdateTaskBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type ProjectListItem,
  type ProjectsListSuccess,
  type TaskListItem,
  type TaskStatus,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

export type TaskEditModalProps = {
  task: TaskListItem;
  onClose: () => void;
  onSuccess: () => void;
};

type FieldErrors = Partial<Record<'name' | 'projectId' | 'status' | 'description', string>>;

function messageForRule(rule: string, fallback: string): string {
  if (rule in VAL_MESSAGES) return VAL_MESSAGES[rule as ValCode];
  return fallback;
}

function detailsFromBody(body: unknown): ApiError['details'] {
  if (!body || typeof body !== 'object' || !('details' in body)) return undefined;
  const details = (body as { details?: ApiError['details'] }).details;
  return Array.isArray(details) ? details : undefined;
}

export function TaskEditModal({ task, onClose, onSuccess }: TaskEditModalProps) {
  const [name, setName] = useState(task.name);
  const [projectId, setProjectId] = useState(task.projectId);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [description, setDescription] = useState(task.description ?? '');
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    apiFetch<ProjectsListSuccess>('/projects?limit=100')
      .then((res) => setProjects(res.data))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (savingRef.current) return;
    setFieldErrors({});
    setFormError(null);

    const payload = {
      name,
      projectId,
      status,
      description: description.trim() ? description.trim() : null,
    };

    const parsed = UpdateTaskBodySchema.safeParse(payload);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const detail of zodIssuesToDetails(parsed.error.issues)) {
        const key = detail.field as keyof FieldErrors;
        next[key] = messageForRule(detail.rule, detail.message);
      }
      setFieldErrors(next);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      savingRef.current = false;
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) return;
        if (err.status === 400 || err.status === 422) {
          const next: FieldErrors = {};
          for (const detail of detailsFromBody(err.body) ?? []) {
            const key = detail.field as keyof FieldErrors;
            next[key] = messageForRule(detail.rule, detail.message);
          }
          if (err.status === 422 && !next.projectId) {
            next.projectId = VAL_MESSAGES['VAL-25'];
          }
          setFieldErrors(next);
          return;
        }
      }
      setFormError('עדכון המשימה נכשל. נסו שוב.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open
      title="עריכת משימה"
      saving={saving}
      onClose={onClose}
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        שם משימה
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.name}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        פרויקט
        <select
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.clientName})
            </option>
          ))}
        </select>
        {fieldErrors.projectId ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.projectId}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        סטטוס
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="open">פתוחה</option>
          <option value="closed">סגורה</option>
        </select>
        {fieldErrors.status ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.status}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        תאור המשימה
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          rows={3}
        />
        {fieldErrors.description ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.description}
          </p>
        ) : null}
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </CrudModal>
  );
}
