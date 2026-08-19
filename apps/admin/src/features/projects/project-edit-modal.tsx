import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UpdateProjectBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type ClientListItem,
  type ClientsListSuccess,
  type ProjectListItem,
  type UserListItem,
  type UsersListSuccess,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

interface ProjectEditModalProps {
  project: ProjectListItem;
  onClose: () => void;
  onSuccess: () => void;
}

type FieldErrors = Partial<
  Record<'name' | 'clientId' | 'leadManagerId' | 'startDate' | 'endDate' | 'description', string>
>;

function messageForRule(rule: string, fallback: string): string {
  if (rule in VAL_MESSAGES) return VAL_MESSAGES[rule as ValCode];
  return fallback;
}

function detailsFromBody(body: unknown): ApiError['details'] {
  if (!body || typeof body !== 'object' || !('details' in body)) return undefined;
  const details = (body as { details?: ApiError['details'] }).details;
  return Array.isArray(details) ? details : undefined;
}

export function ProjectEditModal({ project, onClose, onSuccess }: ProjectEditModalProps) {
  const [name, setName] = useState(project.name);
  const [clientId, setClientId] = useState(project.clientId);
  const [isActive, setIsActive] = useState(project.isActive);
  const [leadManagerId, setLeadManagerId] = useState(project.leadManagerId ?? '');
  const [startDate, setStartDate] = useState(project.startDate ?? '');
  const [endDate, setEndDate] = useState(project.endDate ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    apiFetch<ClientsListSuccess>('/clients?limit=100&isActive=true')
      .then((res) => setClients(res.data))
      .catch(() => {});
    apiFetch<UsersListSuccess>('/users?limit=100')
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, []);

  const pickerClients = useMemo(() => {
    if (clients.some((c) => c.id === project.clientId)) return clients;
    return [
      {
        id: project.clientId,
        name: project.clientName,
        contactInfo: null,
        isActive: false,
      },
      ...clients,
    ];
  }, [clients, project.clientId, project.clientName]);

  // Same fallback as pickerClients: keep the current manager selectable even
  // when the users page no longer returns them.
  const pickerUsers = useMemo(() => {
    if (!project.leadManagerId || users.some((u) => u.id === project.leadManagerId)) return users;
    return [
      {
        id: project.leadManagerId,
        fullName: project.leadManagerName ?? project.leadManagerId,
        email: '',
        role: 'employee' as const,
        isActive: false,
      },
      ...users,
    ];
  }, [users, project.leadManagerId, project.leadManagerName]);

  async function handleSubmit() {
    if (savingRef.current) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = UpdateProjectBodySchema.safeParse({
      name,
      clientId,
      isActive,
      leadManagerId: leadManagerId || null,
      startDate: startDate || null,
      endDate: endDate || null,
      description: description.trim() ? description.trim() : null,
    });
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
      await apiFetch(`/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
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
          if (err.status === 422 && !next.clientId) {
            next.clientId = VAL_MESSAGES['VAL-23'];
          }
          setFieldErrors(next);
          return;
        }
      }
      setFormError('לא ניתן לעדכן את הפרויקט כרגע. נסו שוב.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open
      title="עריכת פרויקט"
      saving={saving}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        שם הפרויקט
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
        שם הלקוח
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">בחר לקוח</option>
          {pickerClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldErrors.clientId ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.clientId}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        שייך מנהל ראשי לפרויקט
        <select
          value={leadManagerId}
          onChange={(e) => setLeadManagerId(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">בחר מנהל</option>
          {pickerUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        {fieldErrors.leadManagerId ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.leadManagerId}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        תאריך התחלה
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.startDate ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.startDate}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        תאריך סיום
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.endDate ? (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.endDate}
          </p>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        תאור הפרויקט
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        פעיל
      </label>
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </CrudModal>
  );
}
