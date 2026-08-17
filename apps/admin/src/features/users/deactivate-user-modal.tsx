import { useState } from 'react';
import type { UserListItem } from '@abra/contracts';
import { apiFetch } from '@/lib/api/client';

interface DeactivateUserModalProps {
  user: UserListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeactivateUserModal({ user, onClose, onSuccess }: DeactivateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'DELETE',
      });
      onSuccess();
      onClose();
    } catch {
      setError('שגיאה בהשבתת המשתמש');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" dir="rtl">
        <h3 className="mb-2 text-lg font-bold text-red-600">השבתת משתמש</h3>
        <p className="mb-4 text-sm text-neutral-700">
          האם אתה בטוח שברצונך להשבית את המשתמש <strong>{user.fullName}</strong>?
          <br />
          <span className="text-xs text-neutral-500">
            (החיבור ינותק באופן מיידי. הנתונים והדיווחים ההיסטוריים יישמרו במידע המערכת.)
          </span>
        </p>

        {error ? (
          <div role="alert" className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={loading}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'משבית…' : 'השבת משתמש'}
          </button>
        </div>
      </div>
    </div>
  );
}
