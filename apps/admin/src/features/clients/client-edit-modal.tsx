import { useState } from 'react';
import type { ClientListItem } from '@abra/contracts';
import { VAL_MESSAGES } from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

interface ClientEditModalProps {
  client: ClientListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClientEditModal({ client, onClose, onSuccess }: ClientEditModalProps) {
  const [name, setName] = useState(client.name);
  const [contactInfo, setContactInfo] = useState(client.contactInfo ?? '');
  const [isActive, setIsActive] = useState(client.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contactInfo: contactInfo || undefined,
          isActive,
        }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        setError(VAL_MESSAGES['VAL-21']);
      } else {
        setError('שגיאה בעדכון פרטי הלקוח');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open
      title="עריכת לקוח"
      saving={saving}
      onClose={onClose}
      onSubmit={() => { void handleSubmit(); }}
    >
      <label className="flex flex-col text-sm">
        שם לקוח
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm">
        פרטי קשר
        <textarea
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          className="rounded border px-2 py-1"
          rows={2}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        פעיל
      </label>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </CrudModal>
  );
}
