import { useState } from 'react';
import type { UserListItem } from '@abra/contracts';
import { apiFetch } from '@/lib/api/client';

interface RestoreUserModalProps {
  user: UserListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function RestoreUserModal({ user, onClose, onSuccess }: RestoreUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/users/${user.id}/restore`, {
        method: 'POST',
      });
      onSuccess();
      onClose();
    } catch {
      setError('שגיאה בהפעלת המשתמש מחדש');
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
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" dir="rtl">
        <h3 className="mb-2 text-lg font-bold text-green-700">הפעלת משתמש מחדש</h3>
        <p className="mb-4 text-sm text-neutral-700">
          האם אתה בטוח שברצונך להפעיל מחדש את המשתמש <strong>{user.fullName}</strong>?
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
            className="rounded-lg bg-slate-400 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={loading}
            className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'מפעיל…' : 'הפעל מחדש'}
          </button>
        </div>
      </div>
    </div>
  );
}
