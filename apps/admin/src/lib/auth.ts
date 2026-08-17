import type { AuthUser } from '@abra/contracts';

const AUTH_KEY = 'abra_admin_auth_session';

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null;
}
