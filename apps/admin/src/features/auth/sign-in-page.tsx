import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '@/lib/api/client';

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError('שם המשתמש או הסיסמה שהוזנו אינם נכונים.');
        return;
      }
      const body = (await response.json()) as { accessToken?: string };
      if (!body.accessToken) {
        setError('ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.');
        return;
      }
      setAccessToken(body.accessToken);
      navigate('/admin/users', { replace: true });
    } catch {
      setError('ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>התחברות</h2>
      <form
        className="mt-4 flex max-w-sm flex-col gap-3"
        onSubmit={(event) => void onSubmit(event)}
      >
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col text-sm">
          אימייל
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          סיסמה
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded border bg-neutral-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {saving ? 'מתחבר…' : 'התחבר'}
        </button>
      </form>
    </section>
  );
}
