import { useState } from 'react';
import type { UserListItem } from '@abra/contracts';
import { apiFetch } from '@/lib/api/client';

interface EditUserModalProps {
  user: UserListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [employmentPercentage, setEmploymentPercentage] = useState('100');
  const [orgUnit, setOrgUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      fullName,
      email,
      role,
      ...(employeeNumber.trim() ? { employeeNumber: employeeNumber.trim() } : {}),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(employmentType.trim() ? { employmentType: employmentType.trim() } : {}),
      ...(employmentPercentage ? { employmentPercentage: Number(employmentPercentage) } : {}),
      ...(orgUnit.trim() ? { orgUnit: orgUnit.trim() } : {}),
    };

    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && err.status === 409) {
        setError('כתובת האימייל כבר קיימת במערכת');
      } else {
        setError('שגיאה בעדכון פרטי המשתמש');
      }
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
        <h3 className="mb-4 text-lg font-bold">עריכת פרטי משתמש</h3>
        {error ? (
          <div role="alert" className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            שם מלא
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>
          <label className="block text-sm">
            אימייל
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>
          <label className="block text-sm">
            תפקיד
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'employee')}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="employee">משתמש רגיל</option>
              <option value="admin">אדמין</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              מספר עובד
              <input
                type="text"
                placeholder="EMP-101"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <label className="block text-sm">
              תואר תפקיד
              <input
                type="text"
                placeholder="מפתח תוכנה"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              סוג העסקה
              <input
                type="text"
                placeholder="מלאה"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <label className="block text-sm">
              אחוז משרה
              <input
                type="number"
                min="1"
                max="100"
                value={employmentPercentage}
                onChange={(e) => setEmploymentPercentage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>
          <label className="block text-sm">
            יחידה ארגונית
            <input
              type="text"
              placeholder="פיתוח"
              value={orgUnit}
              onChange={(e) => setOrgUnit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-400 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-500"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'שומר…' : 'שמור שינויים'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
