import { useEffect, useRef, useState } from 'react';
import {
  CreateProjectBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type ClientListItem,
  type ClientsListSuccess,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

export type ProjectCreateFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type FieldErrors = Partial<Record<'name' | 'clientId', string>>;

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
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<ClientsListSuccess>('/clients?limit=100&isActive=true')
      .then((res) => setClients(res.data))
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setName('');
    setClientId('');
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

    const parsed = CreateProjectBodySchema.safeParse({ name, clientId });
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
      title="פרויקט חדש"
      saving={saving}
      onClose={handleClose}
      onSubmit={() => { void handleSubmit(); }}
    >
      <label className="flex flex-col text-sm">
        שם פרויקט
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-2 py-1"
        />
        {fieldErrors.name ? <p role="alert" className="text-sm text-red-600">{fieldErrors.name}</p> : null}
      </label>
      <label className="flex flex-col text-sm">
        לקוח
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">בחר לקוח</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {fieldErrors.clientId ? <p role="alert" className="text-sm text-red-600">{fieldErrors.clientId}</p> : null}
      </label>
      {formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}
    </CrudModal>
  );
}
