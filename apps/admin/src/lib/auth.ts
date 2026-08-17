import { AuthUser } from '@abra/contracts';

const AUTH_KEY = 'abra_admin_auth_session';

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

type Listener = () => void;
const listeners = new Set<Listener>();

// Snapshot cache so getAuthSession is stable between changes — required by
// useSyncExternalStore, which treats a fresh object identity as a new state.
let cachedSession: AuthSession | null = null;
let cacheValid = false;

function emitChange(): void {
  cacheValid = false;
  for (const listener of listeners) listener();
}

// Subscription point for reactive guards (useSyncExternalStore): fires when
// the session is written or cleared — login, logout, future 401 handling.
export function subscribeToAuthChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Cross-tab sync: a logout (or login) in another tab invalidates this one.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_KEY || event.key === null) emitChange();
  });
}

// Never trust storage: anything can be in there (stale builds, other apps on
// the same origin, manual edits). A blob that doesn't match the contract is
// treated as logged-out instead of becoming a malformed AuthSession.
function parseSession(raw: string): AuthSession | null {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { accessToken, user } = parsed as Record<string, unknown>;
  if (typeof accessToken !== 'string' || accessToken.length === 0) return null;
  const userResult = AuthUser.safeParse(user);
  if (!userResult.success) return null;
  return { accessToken, user: userResult.data };
}

function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY) ?? localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return parseSession(raw);
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  if (!cacheValid) {
    cachedSession = readSession();
    cacheValid = true;
  }
  return cachedSession;
}

// rememberMe picks the backing store: localStorage survives closing the
// browser, sessionStorage dies with the tab. The server-side counterpart is
// the 30-day vs 1-day refresh cookie (KAN-40).
export function setAuthSession(session: AuthSession, rememberMe = false): void {
  const target = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;
  try {
    target.setItem(AUTH_KEY, JSON.stringify(session));
    other.removeItem(AUTH_KEY);
  } finally {
    // Even if storage is unavailable (private modes, blocked iframes), let
    // subscribers re-read; the thrown error reaches the caller as a
    // non-credential failure rather than being mislabeled "wrong password".
    emitChange();
  }
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  } finally {
    emitChange();
  }
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null;
}
