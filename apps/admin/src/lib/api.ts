import { LoginResponse, RefreshResponse, type LoginFormData } from '@abra/contracts';
import { getAuthSession, setAuthSession, type AuthSession } from './auth';

// `||` (not `??`) so a set-but-empty VITE_API_URL also falls back — same
// pitfall server/api/src/env.ts guards with emptyToUndefined.
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
if (!API_URL.startsWith('http')) {
  // Fail at boot, not on the first fetch: a relative API_URL silently hits
  // the SPA rewrite and every request comes back as 200-with-HTML.
  throw new Error(`VITE_API_URL must be an absolute http(s) URL, got: "${API_URL}"`);
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export async function login(data: LoginFormData): Promise<AuthSession> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Required so the browser stores the httpOnly refresh cookie
    credentials: 'include',
    body: JSON.stringify(data),
  });
  // Only a 401 means bad credentials; anything else (400 validation, 429,
  // 5xx) is a service failure and must not be reported as a wrong password.
  if (res.status === 401) {
    throw new InvalidCredentialsError();
  }
  if (!res.ok) {
    throw new Error(`login request failed with status ${res.status}`);
  }
  const body = LoginResponse.parse(await res.json());
  return { accessToken: body.accessToken, user: body.user };
}

let inflightRefresh: Promise<AuthSession | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a fresh session. Resolves null
 * when the cookie is absent/expired/revoked. Concurrent callers share one
 * in-flight request, so a burst of 401s costs a single refresh.
 * On success the session store is updated as a side effect.
 */
export function refreshSession(): Promise<AuthSession | null> {
  inflightRefresh ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = RefreshResponse.parse(await res.json());
      const next = { accessToken: body.accessToken, user: body.user };
      setAuthSession(next);
      return next;
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

/**
 * One-shot session bootstrap for app load: with no in-memory session, ask the
 * refresh cookie. A logged-out visitor pays one cheap 401 and proceeds to
 * /login; a remembered admin lands with a live session and no login form.
 */
export async function bootstrapSession(): Promise<void> {
  if (getAuthSession()) return;
  await refreshSession();
}
