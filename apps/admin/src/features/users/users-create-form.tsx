import { useRef, useState } from 'react';
import {
  CreateUserBodySchema,
  VAL_MESSAGES,
  zodIssuesToDetails,
  type ApiError,
  type ValCode,
} from '@abra/contracts';
import { CrudModal } from '@/components/ui/crud-modal';
import { ApiClientError, apiFetch } from '@/lib/api/client';

const RETRY_ERROR = 'לא ניתן ליצור את המשתמש כרגע. נסו שוב.';

export type UsersCreateFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'role', string>>;

function messageForRule(rule: string, fallback: string): string {
  if (rule in VAL_MESSAGES) {
    return VAL_MESSAGES[rule as ValCode];
  }
  return fallback;
}

function detailsFromUnknown(body: unknown): ApiError['details'] {
  if (!body || typeof body !== 'object' || !('details' in body)) return undefined;
  const details = (body as { details?: ApiError['details'] }).details;
  return Array.isArray(details) ? details : undefined;
}

export function UsersCreateForm({ open, onClose, onCreated }: UsersCreateFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  function resetForm() {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('employee');
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

    const parsed = CreateUserBodySchema.safeParse({ fullName, email, password, role });
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
      await apiFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      savingRef.current = false;
      resetForm();
      onCreated();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          return;
        }
        if (err.status === 400 || err.status === 409) {
          const next: FieldErrors = {};
          for (const detail of detailsFromUnknown(err.body) ?? []) {
            const key = detail.field as keyof FieldErrors;
            next[key] = messageForRule(detail.rule, detail.message);
          }
          setFieldErrors(next);
          if (err.status === 409 && !next.email) {
            setFieldErrors({ email: VAL_MESSAGES['VAL-11'] });
          }
          return;
        }
      }
      setFormError(RETRY_ERROR);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CrudModal
      open={open}
      title="יצירת משתמש"
      saving={saving}
      onClose={handleClose}
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        שם מלא
        <input
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.fullName ? <p role="alert">{fieldErrors.fullName}</p> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        אימייל
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.email ? <p role="alert">{fieldErrors.email}</p> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        סיסמה ראשונית
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {fieldErrors.password ? <p role="alert">{fieldErrors.password}</p> : null}
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        תפקיד
        <select
          required
          value={role}
          onChange={(event) => setRole(event.target.value as 'employee' | 'admin')}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="employee">רגיל</option>
          <option value="admin">אדמין</option>
        </select>
        {fieldErrors.role ? <p role="alert">{fieldErrors.role}</p> : null}
      </label>
      {formError ? <p role="alert">{formError}</p> : null}
    </CrudModal>
  );
}
