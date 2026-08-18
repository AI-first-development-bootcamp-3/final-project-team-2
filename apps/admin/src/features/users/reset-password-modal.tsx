import { useState } from 'react';
import type { UserListItem } from '@abra/contracts';
import { apiFetch } from '@/lib/api/client';

interface ResetPasswordModalProps {
  user: UserListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל 8 תווים לפחות');
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      onSuccess();
      onClose();
    } catch {
      setError('שגיאה באיפוס הסיסמה');
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
        <h3 className="mb-2 text-lg font-bold">איפוס סיסמה למשתמש</h3>
        <p className="mb-4 text-sm text-neutral-600">משתמש: {user.fullName}</p>

        {error ? (
          <div role="alert" className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            סיסמה חדשה
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            אימות סיסמה חדשה
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'מאפס…' : 'אפס סיסמה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
