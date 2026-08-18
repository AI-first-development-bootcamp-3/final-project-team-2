import { useEffect, useRef, useState } from 'react';
import {
  CreateAssignmentBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type TaskListItem,
  type TasksListSuccess,
  type UserListItem,
  type UsersListSuccess,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

export type AssignmentCreateFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type FieldErrors = Partial<Record<'userId' | 'taskId', string>>;

function messageForRule(rule: string, fallback: string): string {
  if (rule in VAL_MESSAGES) return VAL_MESSAGES[rule as ValCode];
  return fallback;
}

function detailsFromBody(body: unknown): ApiError['details'] {
  if (!body || typeof body !== 'object' || !('details' in body)) return undefined;
  const details = (body as { details?: ApiError['details'] }).details;
  return Array.isArray(details) ? details : undefined;
}

export function AssignmentCreateForm({ open, onClose, onCreated }: AssignmentCreateFormProps) {
  const [userId, setUserId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<UsersListSuccess>('/users?limit=100')
      .then((res) => setUsers(res.data.filter((u) => u.isActive)))
      .catch(() => {});

    apiFetch<TasksListSuccess>('/tasks?limit=100&status=open')
      .then((res) => setTasks(res.data))
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setUserId('');
    setTaskId('');
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (savingRef.current) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = CreateAssignmentBodySchema.safeParse({ userId, taskId });
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
      await apiFetch('/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      savingRef.current = false;
      resetForm();
      onCreated();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) return;
        if (err.status === 409) {
          setFormError('השיוך כבר קיים במערכת');
          return;
        }
        if (err.status === 400 || err.status === 422) {
          const next: FieldErrors = {};
          for (const detail of detailsFromBody(err.body) ?? []) {
            const key = detail.field as keyof FieldErrors;
            next[key] = messageForRule(detail.rule, detail.message);
          }
          if (err.status === 422 && (!next.userId || !next.taskId)) {
            const msg = VAL_MESSAGES['VAL-26'];
            if (!next.userId) next.userId = msg;
            if (!next.taskId) next.taskId = msg;
          }
          setFieldErrors(next);
          return;
        }
      }
      setFormError('לא ניתן ליצור את השיוך כרגע. נסו שוב.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open={open}
      title="שיוך חדש"
      saving={saving}
      onClose={handleClose}
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <label className="flex flex-col text-sm">
        עובד
        <select
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">בחר עובד</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.email})
            </option>
          ))}
        </select>
        {fieldErrors.userId ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.userId}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col text-sm">
        משימה
        <select
          required
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">בחר משימה</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.projectName} - {t.clientName})
            </option>
          ))}
        </select>
        {fieldErrors.taskId ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.taskId}
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
