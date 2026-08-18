import { useEffect, useState } from 'react';
import type { ClientListItem, ClientsListSuccess, ProjectListItem } from '@abra/contracts';
import { VAL_MESSAGES } from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

interface ProjectEditModalProps {
  project: ProjectListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProjectEditModal({ project, onClose, onSuccess }: ProjectEditModalProps) {
  const [name, setName] = useState(project.name);
  const [clientId, setClientId] = useState(project.clientId);
  const [isActive, setIsActive] = useState(project.isActive);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClientsListSuccess>('/clients?limit=100&isActive=true')
      .then((res) => setClients(res.data))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clientId, isActive }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 422) {
        setError(VAL_MESSAGES['VAL-23']);
      } else {
        setError('שגיאה בעדכון פרטי הפרויקט');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open
      title="עריכת פרויקט"
      saving={saving}
      onClose={onClose}
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <label className="flex flex-col text-sm">
        שם פרויקט
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-2 py-1"
        />
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
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        פעיל
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </CrudModal>
  );
}
