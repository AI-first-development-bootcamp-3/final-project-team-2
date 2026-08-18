import { LoginResponse, RefreshResponse, type LoginFormData } from '@abra/contracts';
import { clearAuthSession, getAuthSession, setAuthSession, type AuthSession } from './auth';

const API_URL: string = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api/v1';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('session expired');
    this.name = 'SessionExpiredError';
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
  if (!res.ok) {
    throw new InvalidCredentialsError();
  }
  const body = LoginResponse.parse(await res.json());
  return { accessToken: body.accessToken, user: body.user };
}

async function tryRefresh(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const body = RefreshResponse.parse(await res.json());
  return body.accessToken;
}

/**
 * Authenticated fetch: attaches the access token; on 401 refreshes once and
 * retries. If the refresh fails too, the session is cleared and the caller
 * should send the user to /login?expired=1.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const doFetch = (token: string | undefined) =>
    fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const first = await doFetch(getAuthSession()?.accessToken);
  if (first.status !== 401) {
    return first;
  }

  const freshToken = await tryRefresh();
  if (!freshToken) {
    clearAuthSession();
    throw new SessionExpiredError();
  }

  const session = getAuthSession();
  if (session) {
    setAuthSession({ ...session, accessToken: freshToken });
  }
  return doFetch(freshToken);
}
