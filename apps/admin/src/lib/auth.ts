import type { AuthUser } from '@abra/contracts';

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

// In-memory only — never web storage. Script injection cannot read what is
// not stored, and the httpOnly refresh cookie is the single durable
// credential: on a cold load the session is rebuilt via POST /auth/refresh
// (see bootstrapSession in api.ts).
let session: AuthSession | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

// Subscription point for reactive guards (useSyncExternalStore): fires when
// the session is written or cleared — login, logout, 401 handling.
export function subscribeToAuthChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthSession(): AuthSession | null {
  return session;
}

export function setAuthSession(next: AuthSession): void {
  session = next;
  emitChange();
}

export function clearAuthSession(): void {
  if (session === null) return;
  session = null;
  emitChange();
}

/** The only role the console admits (GENERAL_SPEC §5.5). */
export function isAdmin(candidate: AuthSession | null): boolean {
  return candidate?.user.role === 'admin';
}
