const ACCESS_TOKEN_KEY = 'abra.admin.accessToken';

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function redirectToSignIn(): void {
  window.location.assign('/admin/login');
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
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearAccessToken();
    redirectToSignIn();
    throw new ApiClientError(401, undefined);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ApiClientError(response.status, body);
  }

  return (await response.json()) as T;
}
