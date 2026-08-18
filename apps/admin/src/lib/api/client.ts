import { clearAuthSession, getAuthSession } from '../auth';
import { API_URL, refreshSession } from '../api';

// Single session source of truth: the in-memory KAN-70 auth session. This
// client reads it, refreshes it once on 401, and clears it when the refresh
// cookie is dead too.
export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function clearAccessToken(): void {
  clearAuthSession();
}

export function redirectToSignIn(): void {
  window.location.assign('/login');
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers });
  };

  let response = await doFetch(getAccessToken());

  // 401: the ~15-minute access token likely expired. Refresh once off the
  // httpOnly cookie and retry; a second 401 (or failed refresh) means the
  // session is genuinely dead — clear it and hand the user to /login.
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await doFetch(refreshed.accessToken);
    }
    if (response.status === 401) {
      clearAccessToken();
      redirectToSignIn();
      throw new ApiClientError(401, undefined);
    }
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ApiClientError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
