import { useEffect, useRef, useState } from 'react';
import {
  CreateProjectBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type ClientListItem,
  type ClientsListSuccess,
  type UserListItem,
  type UsersListSuccess,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

export type ProjectCreateFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

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

export function ProjectCreateForm({ open, onClose, onCreated }: ProjectCreateFormProps) {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [leadManagerId, setLeadManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<ClientsListSuccess>('/clients?limit=100&isActive=true')
      .then((res) => setClients(res.data))
      .catch(() => {});
    apiFetch<UsersListSuccess>('/users?limit=100')
      .then((res) => setUsers(res.data))
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setName('');
    setClientId('');
    setLeadManagerId('');
    setStartDate('');
    setEndDate('');
    setDescription('');
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

    const parsed = CreateProjectBodySchema.safeParse({
      name,
      clientId,
      ...(leadManagerId ? { leadManagerId } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
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
      await apiFetch('/projects', {
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
      setFormError('לא ניתן ליצור את הפרויקט כרגע. נסו שוב.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open={open}
      title="יצירת פרויקט"
      saving={saving}
      submitLabel="צור פרויקט"
      onClose={handleClose}
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
          {clients.map((c) => (
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
          {users.map((u) => (
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
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </CrudModal>
  );
}
